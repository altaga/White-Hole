import {GOOGLE_URL_API} from '@env';
import {ethers} from 'ethers';
import React, {Component, Fragment} from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNPrint from 'react-native-print';
import QRCode from 'react-native-qrcode-svg';
import Crypto from 'react-native-quick-crypto';
import VirtualKeyboard from 'react-native-virtual-keyboard';
import checkMark from '../../assets/checkMark.png';
import {logo} from '../../assets/logo';
import Header from '../../components/header';
import GlobalStyles, {
  mainColor,
  secondaryColor,
  tertiaryColor,
} from '../../styles/styles';
import {
  CloudPublicKeyEncryption,
  basePublicKey,
  blockchains,
} from '../../utils/constants';
import ContextModule from '../../utils/contextModule';
import {deleteLeadingZeros, formatInputText} from '../../utils/utils';
import ReadCard from './components/readCard';
import {abiBatchTokenBalances} from '../../contracts/batchTokenBalances';

const BaseStatePaymentWallet = {
  // Base
  publicKeyCard: basePublicKey,
  balances: blockchains.map(x => x.tokens.map(() => 0)),
  activeTokens: blockchains.map(x => x.tokens.map(() => false)),
  stage: 0, // 0
  amount: '0.00', // "0.00"
  cardInfo: null,
  loading: true,
  status: 'Processing...',
  explorerURL: '',
  transactionDisplay: {
    amount: '0.00',
    name: blockchains[0].tokens[0].symbol,
    tokenAddress: blockchains[0].tokens[0].address,
    icon: blockchains[0].tokens[0].icon,
  },
  // QR print
  saveData: '',
};

const sortByPriority = (array, key) => {
  return array.sort((a, b) => {
    const getPriority = value => {
      if (value.includes('USDC')) return 2; // Highest priority
      if (value.includes('EURC')) return 1; // Second priority
      return 0; // No priority
    };
    const priorityA = getPriority(a[key]);
    const priorityB = getPriority(b[key]);
    return priorityB - priorityA; // Sort descending by priority
  });
};

const plain = sortByPriority(
  blockchains
    .map((blockchain, i, arrayB) =>
      blockchain.tokens.map((token, j, arrayT) => {
        return {
          ...blockchain,
          ...token,
          i,
          j,
          arrayB: arrayB.length,
          arrayT: arrayT.length,
        };
      }),
    )
    .flat(),
  'symbol',
);

class PaymentWallet extends Component {
  constructor(props) {
    super(props);
    this.state = BaseStatePaymentWallet;
    this.provider = blockchains.map(
      x => new ethers.providers.JsonRpcProvider(x.rpc),
    );
    this.controller = new AbortController();
    this.svg = null;
  }

  static contextType = ContextModule;

  async getDataURL() {
    return new Promise(async (resolve, reject) => {
      this.svg.toDataURL(async data => {
        this.setState(
          {
            saveData: data,
          },
          () => resolve('ok'),
        );
      });
    });
  }

  async print() {
    await this.getDataURL();
    const results = await RNHTMLtoPDF.convert({
      html: `
        <div style="text-align: center;">
          <img src='${logo}' width="400px"></img>
          <h1 style="font-size: 3rem;">--------- Original Reciept ---------</h1>
          <h1 style="font-size: 3rem;">Date: ${new Date().toLocaleDateString()}</h1>
          <h1 style="font-size: 3rem;">Type: Card Payment</h1>
          <h1 style="font-size: 3rem;">------------------ • ------------------</h1>
          <h1 style="font-size: 3rem;">Transaction</h1>
          <h1 style="font-size: 3rem;">Amount: ${deleteLeadingZeros(
            formatInputText(this.state.transactionDisplay.amount),
          )} ${this.state.transactionDisplay.name}</h1>
          <h1 style="font-size: 3rem;">------------------ • ------------------</h1>
          <img style="width:70%" src='${
            'data:image/png;base64,' + this.state.saveData
          }'></img>
      </div>
      `,
      fileName: 'print',
      base64: true,
    });
    await RNPrint.print({filePath: results.filePath});
  }

  componentDidMount() {
    this.props.navigation.addListener('focus', async () => {
      this.setState({
        loading: false,
      });
    });
  }

  encryptCardData(cardData) {
    const encrypted = Crypto.publicEncrypt(
      {
        key: CloudPublicKeyEncryption,
      },
      Buffer.from(cardData, 'utf8'),
    );
    return encrypted.toString('base64');
  }

  async processPayment() {
    await this.setStateAsync({
      explorerURL: `${
        blockchains[this.context.value.transactionData.chainSelected]
          .blockExplorer
      }tx/${result.result}`,
      status: 'Confirmed',
      loading: false,
    });
  }

  async payFromCard(i, j) {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const raw = JSON.stringify({
      user: this.encryptCardData(
        `${this.state.cardInfo.card}${this.state.cardInfo.exp}`,
      ),
      card: true,
      command: j === 0 ? 'transfer' : 'tokenTransfer',
      chain: i,
      token: j,
      amount: (
        this.state.amount / this.context.value.usdConversion[i][j]
      ).toFixed(blockchains[i].tokens[j].decimals),
      destinationAddress: this.context.value.wallets.eth.address,
    });
    console.log(raw);
    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow',
    };
    fetch(`${GOOGLE_URL_API}/createTransfers`, requestOptions)
      .then(response => response.json())
      .then(async result => {
        console.log(result);
        if (result.error === null) {
          await this.setStateAsync({
            status: 'Confirmed',
            loading: false,
            explorerURL: `${blockchains[i].blockExplorer}tx/${result.result}`,
          });
        }
      })
      .catch(error => console.error(error));
  }

  async getAddressFromCard() {
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');
      const raw = JSON.stringify({
        data: this.encryptCardData(
          `${this.state.cardInfo.card}${this.state.cardInfo.exp}`,
        ),
      });
      const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow',
      };
      fetch(`${GOOGLE_URL_API}/getCard`, requestOptions)
        .then(response => response.json())
        .then(res => {
          console.log(res);
          if (res.error === null) {
            resolve(res.result);
          } else {
            console.log(res.error);
            reject(res.error);
          }
        })
        .catch(error => reject(error));
    });
  }

  async getBalances() {
    const publicKey = this.state.publicKeyCard;
    const tokensArrays = blockchains
      .map(x =>
        x.tokens.filter(
          token =>
            token.address !== '0x0000000000000000000000000000000000000000',
        ),
      )
      .map(x => x.map(y => y.address));
    const batchBalancesContracts = blockchains.map(
      (x, i) =>
        new ethers.Contract(
          x.batchBalancesAddress,
          abiBatchTokenBalances,
          this.provider[i],
        ),
    );
    const nativeBalances = await Promise.all(
      this.provider.map(
        x => x.getBalance(publicKey) ?? ethers.BigNumber.from(0),
      ),
    );
    const tokenBalances = await Promise.all(
      batchBalancesContracts.map(
        (x, i) =>
          x.batchBalanceOf(publicKey, tokensArrays[i]) ??
          ethers.BigNumber.from(0),
      ),
    );
    let balancesMerge = [];
    nativeBalances.forEach((x, i) =>
      balancesMerge.push([x, ...tokenBalances[i]]),
    );
    const balances = blockchains.map((x, i) =>
      x.tokens.map((y, j) => {
        return ethers.utils.formatUnits(balancesMerge[i][j], y.decimals);
      }),
    );
    console.log(balances);
    const activeTokens = balances.map((tokens, i) =>
      tokens.map(
        (balance, j) =>
          balance >
          parseFloat(deleteLeadingZeros(formatInputText(this.state.amount))) /
            this.context.value.usdConversion[i][j],
      ),
    );
    await this.setStateAsync({balances, activeTokens, stage: 2});
  }
  // Utils
  async setStateAsync(value) {
    return new Promise(resolve => {
      this.setState(
        {
          ...value,
        },
        () => resolve(),
      );
    });
  }

  render() {
    return (
      <Fragment>
        <SafeAreaView style={[GlobalStyles.container]}>
          <Header />
          <View style={[GlobalStyles.mainFull]}>
            {this.state.stage === 0 && (
              <View
                style={{
                  height: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 40,
                }}>
                <Text style={GlobalStyles.title}>Enter Amount (USD)</Text>
                <Text style={{fontSize: 36, color: 'white'}}>
                  {deleteLeadingZeros(formatInputText(this.state.amount))}
                </Text>
                <VirtualKeyboard
                  style={{
                    width: '80vw',
                    fontSize: 40,
                    textAlign: 'center',
                    marginTop: -10,
                  }}
                  cellStyle={{
                    width: 50,
                    height: 50,
                    borderWidth: 1,
                    borderColor: '#77777777',
                    borderRadius: 5,
                    margin: 1,
                  }}
                  color="white"
                  pressMode="string"
                  onPress={amount => this.setState({amount})}
                  decimal
                />
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                    width: Dimensions.get('window').width,
                  }}>
                  <Pressable
                    style={GlobalStyles.buttonStyle}
                    onPress={() => this.setState({stage: 1})}>
                    <Text style={GlobalStyles.buttonText}>Pay with Card</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {this.state.stage === 1 && (
              <View
                style={{
                  height: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 40,
                }}>
                <View style={{alignItems: 'center'}}>
                  <Text style={GlobalStyles.title}>Amount (USD)</Text>
                  <Text style={{fontSize: 36, color: 'white'}}>
                    $ {deleteLeadingZeros(formatInputText(this.state.amount))}
                  </Text>
                </View>
                <ReadCard
                  cardInfo={async cardInfo => {
                    if (cardInfo) {
                      await this.setStateAsync({cardInfo});
                      try {
                        const publicKeyCard = await this.getAddressFromCard();
                        console.log(publicKeyCard);
                        await this.setStateAsync({publicKeyCard});
                        await this.getBalances();
                      } catch (error) {
                        console.log(error);
                        this.setState({stage: 0});
                      }
                    }
                  }}
                />
                <View
                  key={
                    'This element its only to align the NFC reader in center'
                  }
                />
              </View>
            )}
            {this.state.stage === 2 && (
              <React.Fragment>
                <Text style={[GlobalStyles.titlePaymentToken]}>
                  Select Payment Token
                </Text>
                <ScrollView>
                  {plain.map((token, i) =>
                    this.state.activeTokens[token.i][token.j] ? (
                      <View
                        key={`${token.name}-${token.i}-${token.j}`}
                        style={{
                          paddingBottom:
                            token.arrayB === token.i + 1 &&
                            token.arrayT === token.j + 1
                              ? 0
                              : 20,
                          marginBottom: 20,
                        }}>
                        <Pressable
                          disabled={this.state.loading}
                          style={[
                            GlobalStyles.buttonStyle,
                            this.state.loading ? {opacity: 0.5} : {},
                            (token.symbol === 'USDC' ||
                              token.symbol === 'EURC') && {
                              backgroundColor: '#2775ca',
                              borderColor: '#2775ca',
                            },
                          ]}
                          onPress={async () => {
                            try {
                              await this.setStateAsync({
                                transactionDisplay: {
                                  amount: (
                                    this.state.amount /
                                    this.context.value.usdConversion[token.i][
                                      token.j
                                    ]
                                  ).toFixed(6),
                                  name: token.symbol,
                                  icon: token.icon,
                                },
                                status: 'Processing...',
                                stage: 3,
                                explorerURL: '',
                                loading: true,
                              });
                              await this.payFromCard(token.i, token.j);
                            } catch (error) {
                              console.log(error);
                              await this.setStateAsync({loading: false});
                            }
                          }}>
                          <Text style={GlobalStyles.buttonText}>
                            {token.name}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Fragment key={`${token.name}-${token.i}-${token.j}`} />
                    ),
                  )}
                </ScrollView>
              </React.Fragment>
            )}
            {
              // Stage 3
              this.state.stage === 3 && (
                <View
                  style={{
                    paddingVertical: 20,
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'space-between',
                  }}>
                  <Image
                    source={checkMark}
                    alt="check"
                    style={{width: 200, height: 200}}
                  />
                  <Text
                    style={{
                      textShadowRadius: 1,
                      fontSize: 28,
                      fontWeight: 'bold',
                      color:
                        this.state.status === 'Confirmed'
                          ? mainColor
                          : secondaryColor,
                    }}>
                    {this.state.status}
                  </Text>
                  <View
                    style={[
                      GlobalStyles.networkShow,
                      {
                        width: Dimensions.get('screen').width * 0.9,
                      },
                    ]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-around',
                      }}>
                      <View style={{marginHorizontal: 20}}>
                        <Text style={{fontSize: 20, color: 'white'}}>
                          Transaction
                        </Text>
                        <Text style={{fontSize: 14, color: 'white'}}>
                          Card Payment
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        marginHorizontal: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <View style={{marginHorizontal: 10}}>
                        {this.state.transactionDisplay.icon}
                      </View>
                      <Text style={{color: 'white'}}>
                        {`${deleteLeadingZeros(
                          formatInputText(this.state.transactionDisplay.amount),
                        )}`}{' '}
                        {this.state.transactionDisplay.name}
                      </Text>
                    </View>
                  </View>
                  <View style={GlobalStyles.buttonContainer}>
                    <Pressable
                      disabled={this.state.explorerURL === ''}
                      style={[
                        GlobalStyles.buttonStyle,
                        this.state.explorerURL === ''
                          ? {opacity: 0.5, borderColor: 'black'}
                          : {},
                      ]}
                      onPress={() => Linking.openURL(this.state.explorerURL)}>
                      <Text style={GlobalStyles.buttonText}>
                        View on Explorer
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        GlobalStyles.buttonStyle,
                        {
                          backgroundColor: secondaryColor,
                          borderColor: secondaryColor,
                        },
                        this.state.explorerURL === ''
                          ? {opacity: 0.5, borderColor: 'black'}
                          : {},
                      ]}
                      onPress={async () => {
                        this.print();
                      }}
                      disabled={this.state.explorerURL === ''}>
                      <Text style={GlobalStyles.buttonText}>Show Receipt</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        GlobalStyles.buttonStyle,
                        {
                          backgroundColor: tertiaryColor,
                          borderColor: tertiaryColor,
                        },
                        this.state.explorerURL === ''
                          ? {opacity: 0.5, borderColor: 'black'}
                          : {},
                      ]}
                      onPress={async () => {
                        this.setState({
                          stage: 0,
                          explorerURL: '',
                          check: 'Check',
                          status: 'Processing...',
                          errorText: '',
                          amount: '0.00', // "0.00"
                        });
                      }}
                      disabled={this.state.explorerURL === ''}>
                      <Text style={GlobalStyles.buttonText}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              )
            }
          </View>
        </SafeAreaView>
        <View
          style={{
            position: 'absolute',
            bottom: -(Dimensions.get('screen').height * 1.1),
          }}>
          <QRCode
            value={
              this.state.explorerURL === ''
                ? 'placeholder'
                : this.state.explorerURL
            }
            size={Dimensions.get('window').width * 0.6}
            ecl="L"
            getRef={c => (this.svg = c)}
          />
        </View>
      </Fragment>
    );
  }
}

export default PaymentWallet;
