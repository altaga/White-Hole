//import {SOLANA_RPC} from '@env';
import {ethers} from 'ethers';
import React, {Component} from 'react';
import {
  Dimensions,
  Keyboard,
  NativeEventEmitter,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import IconIonIcons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/header';
import {abiERC20} from '../../contracts/erc20';
import GlobalStyles, {secondaryColor} from '../../styles/styles';
import {blockchains} from '../../utils/constants';
import ContextModule from '../../utils/contextModule';
import {
  balancedSaving,
  epsilonRound,
  percentageSaving,
  setChains,
  setTokens,
} from '../../utils/utils';
import Cam from './components/cam';
import KeyboardAwareScrollViewComponent from './components/keyboardAvoid';

const SendWalletBaseState = {
  // Transaction settings
  toAddress: '', // ""
  amount: '', //
  chainSelected: setChains(blockchains)[0], // ""
  tokenSelected: setTokens(blockchains[0].tokens)[0], // ""
  transaction: {},
  // Status
  stage: 0,
  check: 'Check',
  errorText: '',
  loading: false,
};

class SendWallet extends Component {
  constructor(props) {
    super(props);
    this.state = SendWalletBaseState;
    this.provider = blockchains.map(
      x => new ethers.providers.JsonRpcProvider(x.rpc),
    );
    this.controller = new AbortController();
    this.EventEmitter = new NativeEventEmitter();
  }

  static contextType = ContextModule;

  async componentDidMount() {
    console.log(
      blockchains.map((blockchain, i) =>
        blockchain.tokens.map((token, j) => {
          return {address: token.address, decimals: token.decimals};
        }),
      ),
    );
    this.props.navigation.addListener('focus', async () => {
      console.log(this.props.route.name);
      this.EventEmitter.addListener('refresh', async () => {
        this.setState(SendWalletBaseState);
        Keyboard.dismiss();
      });
    });
    this.props.navigation.addListener('blur', async () => {
      this.setState(SendWalletBaseState);
      this.EventEmitter.removeAllListeners('refresh');
    });
  }

  async transfer() {
    const label =
      this.state.tokenSelected.index === 0 ? 'transfer' : 'tokenTransfer';
    let transaction = {};
    let transactionSavings = {};
    let savings = 0;
    if (label === 'transfer') {
      transaction = {
        from: this.context.value.wallets.eth.address,
        to: this.state.toAddress,
        value: ethers.utils.parseEther(this.state.amount),
      };
    } else if (label === 'tokenTransfer') {
      const tokenInterface = new ethers.utils.Interface(abiERC20);
      transaction = {
        from: this.context.value.wallets.eth.address,
        to: this.state.tokenSelected.address,
        data: tokenInterface.encodeFunctionData('transfer', [
          this.state.toAddress,
          ethers.utils.parseUnits(
            this.state.amount,
            this.state.tokenSelected.decimals,
          ),
        ]),
      };
    }
    if (label === 'transfer' && this.context.value.savingsFlag) {
      savings =
        this.context.value.protocolSelected === 1
          ? balancedSaving(
              this.state.amount,
              this.context.value.usdConversion[this.state.chainSelected.index][
                this.state.tokenSelected.index
              ],
            )
          : percentageSaving(this.state.amount, this.context.value.percentage);
      savings = epsilonRound(savings, 18).toString(); // Avoid excessive decimals error
      transactionSavings = {
        from: this.context.value.wallets.eth.address,
        to: this.context.value.walletsSavings.eth.address,
        value: ethers.utils.parseEther(savings),
      };
    } else if (label === 'tokenTransfer' && this.context.value.savingsFlag) {
      const valueOnETH =
        (this.state.amount *
          this.context.value.usdConversion[this.state.chainSelected.index][
            this.state.tokenSelected.index
          ]) /
        this.context.value.usdConversion[this.state.chainSelected.index][0];
      savings =
        this.context.value.protocolSelected === 1
          ? balancedSaving(
              valueOnETH,
              this.context.value.usdConversion[
                this.state.chainSelected.index
              ][0],
            )
          : percentageSaving(valueOnETH, this.context.value.percentage);
      savings = epsilonRound(savings, 18).toString();
      transactionSavings = {
        from: this.context.value.wallets.eth.address,
        to: this.context.value.walletsSavings.eth.address,
        value: ethers.utils.parseEther(savings),
      };
    }
    this.context.setValue({
      isTransactionActive: true,
      transactionData: {
        // Wallet Selection
        walletSelector: 0,
        // Commands
        command: label,
        chainSelected: this.state.chainSelected.index,
        tokenSelected: this.state.tokenSelected.index,
        // Transaction
        transaction,
        // With Savings
        withSavings: this.context.value.savingsFlag,
        transactionSavings,
        // Single Display
        // Display
        label,
        to: this.state.toAddress,
        amount: this.state.amount,
        tokenSymbol: this.state.tokenSelected.label,
        // Display Savings
        savedAmount: savings,
      },
    });
    await this.setStateAsync({loading: false});
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
      <SafeAreaView style={GlobalStyles.container}>
        <Header />
        {this.state.stage === 0 && (
          <KeyboardAwareScrollViewComponent>
            <SafeAreaView style={GlobalStyles.mainFull}>
              <ScrollView
                contentContainerStyle={{
                  height: '96%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    alignItems: 'center',
                  }}>
                  <View style={{marginTop: 20}} />
                  <Text style={GlobalStyles.formTitleCard}>Address</Text>
                  <View
                    style={{
                      width: Dimensions.get('screen').width,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                    <View style={{width: '90%'}}>
                      <TextInput
                        multiline
                        numberOfLines={1}
                        style={[
                          GlobalStyles.input,
                          {fontSize: 20, height: 70, paddingHorizontal: 20},
                        ]}
                        keyboardType="default"
                        value={this.state.toAddress}
                        onChangeText={value => {
                          this.setState({toAddress: value});
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        this.setStateAsync({
                          stage: 10,
                        });
                      }}
                      style={{width: '10%'}}>
                      <IconIonIcons name="qr-code" size={30} color={'white'} />
                    </Pressable>
                  </View>
                  <Text style={GlobalStyles.formTitleCard}>Select Network</Text>
                  <RNPickerSelect
                    style={{
                      inputAndroidContainer: {
                        textAlign: 'center',
                      },
                      inputAndroid: {
                        textAlign: 'center',
                        color: 'gray',
                      },
                      viewContainer: {
                        ...GlobalStyles.input,
                        width: Dimensions.get('screen').width * 0.9,
                      },
                    }}
                    value={this.state.chainSelected.value}
                    items={setChains(blockchains)}
                    onValueChange={network => {
                      this.setState({
                        chainSelected: setChains(blockchains)[network],
                        tokenSelected: setTokens(
                          blockchains[network].tokens,
                        )[0],
                      });
                    }}
                  />
                  <Text style={GlobalStyles.formTitleCard}>Select Token</Text>
                  <RNPickerSelect
                    style={{
                      inputAndroidContainer: {
                        textAlign: 'center',
                      },
                      inputAndroid: {
                        textAlign: 'center',
                        color: 'gray',
                      },
                      viewContainer: {
                        ...GlobalStyles.input,
                        width: Dimensions.get('screen').width * 0.9,
                      },
                    }}
                    value={this.state.tokenSelected.value}
                    items={setTokens(
                      blockchains[this.state.chainSelected.value].tokens,
                    )}
                    onValueChange={token => {
                      this.setState({
                        tokenSelected: setTokens(
                          blockchains[this.state.chainSelected.value].tokens,
                        )[token],
                      });
                    }}
                  />
                  <Text style={GlobalStyles.formTitleCard}>Amount</Text>
                  <View
                    style={{
                      width: Dimensions.get('screen').width,
                      flexDirection: 'row',
                      justifyContent: 'space-around',
                      alignItems: 'center',
                    }}>
                    <View style={{width: '100%'}}>
                      <TextInput
                        style={[GlobalStyles.input]}
                        keyboardType="decimal-pad"
                        value={this.state.amount}
                        onChangeText={amount => {
                          this.setState({amount});
                        }}
                      />
                    </View>
                  </View>
                </View>
                <Pressable
                  //disabled={this.state.loading}
                  style={[
                    GlobalStyles.buttonStyle,
                    this.state.loading ? {opacity: 0.5} : {},
                  ]}
                  onPress={async () => {
                    console.log('Transfer');
                    await this.setStateAsync({loading: true});
                    await this.transfer();
                    await this.setStateAsync({loading: false});
                  }}>
                  <Text style={[GlobalStyles.buttonText]}>
                    {this.state.check}
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAwareScrollViewComponent>
        )}
        {
          // Scan QR
        }
        {this.state.stage === 10 && (
          <View style={[GlobalStyles.main, {justifyContent: 'space-evenly'}]}>
            <View>
              <Text style={{color: 'white', fontSize: 28}}>Scan QR</Text>
            </View>
            <View
              style={{
                height: Dimensions.get('screen').height * 0.5,
                width: Dimensions.get('screen').width * 0.8,
                marginVertical: 20,
                borderColor: secondaryColor,
                borderWidth: 5,
                borderRadius: 10,
              }}>
              <Cam
                callbackAddress={e => {
                  console.log(e);
                  this.setState({
                    toAddress: e,
                    stage: 0,
                  });
                }}
              />
            </View>
            <Pressable
              style={[GlobalStyles.buttonCancelStyle]}
              onPress={async () => {
                this.setState({
                  stage: 0,
                });
              }}>
              <Text style={GlobalStyles.buttonCancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    );
  }
}

export default SendWallet;
