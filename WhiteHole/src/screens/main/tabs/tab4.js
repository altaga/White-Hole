import {ethers} from 'ethers';
import React, {Component} from 'react';
import {
  Dimensions,
  Keyboard,
  NativeEventEmitter,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlobalStyles, {mainColor} from '../../../styles/styles';
import {blockchains, refreshTime} from '../../../utils/constants';
import ContextModule from '../../../utils/contextModule';
import {
  decrypt,
  getAsyncStorageValue,
  removeDuplicatesByKey,
  setAsyncStorageValue,
} from '../../../utils/utils';
import {abiMultiChainChat} from '../../../contracts/multiChainChat';

const baseTab4State = {
  loading: false,
};

const chains = blockchains.slice(1, blockchains.length);

class Tab4 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab4State;
    this.provider = chains.map(
      x => new ethers.providers.JsonRpcProvider(x.rpc),
    );
    this.EventEmitter = new NativeEventEmitter();
    this.controller = new AbortController();
  }
  static contextType = ContextModule;

  async componentDidMount() {
    this.EventEmitter.addListener('refresh', async () => {
      Keyboard.dismiss();
      await setAsyncStorageValue({lastRefreshChat: Date.now()});
      this.refresh();
    });
    const refreshCheck = Date.now();
    const lastRefresh = await this.getLastRefreshChat();
    if (refreshCheck - lastRefresh >= refreshTime) {
      console.log('Refreshing...');
      await setAsyncStorageValue({lastRefreshChat: Date.now()});
      await this.refresh();
    } else {
      console.log(
        `Next refresh Available: ${Math.round(
          (refreshTime - (refreshCheck - lastRefresh)) / 1000,
        )} Seconds`,
      );
    }
  }

  async getMessages() {
    const chatContracts = chains.map(
      (x, i) =>
        new ethers.Contract(x.crossChainChat, abiMultiChainChat, this.provider[i]),
    );
    const counterByAddresses = await Promise.all(
      chatContracts.map(contract =>
        contract.chatCounter(this.context.value.wallets.eth.address),
      ),
    );
    if (counterByAddresses.some(value => value.toNumber() > 0)) {
      let messages = [];
      for (const [index, counter] of counterByAddresses.entries()) {
        for (let i = 0; counter.toNumber() > i; i++) {
          const message = await chatContracts[index].chatHistory(
            this.context.value.wallets.eth.address,
            i,
          );
          let myJson;
          if (
            this.context.value.wallets.eth.address === message.to.toLowerCase()
          ) {
            myJson = {
              fromChainId: message.fromChainId,
              toChainId: message.toChainId,
              from: message.from,
              to: message.to,
              message: decrypt(
                message.messTo,
                this.context.value.wallets.eth.address,
                message.iv,
              ),
              amount: ethers.utils.formatUnits(message.amount, 6),
              blocktime: message.blocktime.toNumber() * 1000,
              index: i,
            };
          } else {
            myJson = {
              fromChainId: message.fromChainId,
              toChainId: message.toChainId,
              from: message.from,
              to: message.to,
              message: decrypt(
                message.messFrom,
                this.context.value.wallets.eth.address,
                message.iv,
              ),
              amount: ethers.utils.formatUnits(message.amount, 6),
              blocktime: message.blocktime.toNumber() * 1000,
              index: i,
            };
          }
          messages.push(myJson);
        }
      }
      // This function can be optimized
      const chat = messages.map((x, _, arr) => {
        let json = {};
        if (x.from === this.context.value.wallets.eth.address) {
          json['address'] = x.to;
        } else {
          json['address'] = x.from;
        }
        json['messages'] = arr.filter(
          y => y.to === json['address'] || y.from === json['address'],
        );
        json['messages'] = removeDuplicatesByKey(
          [...json['messages']],
          'blocktime',
        );
        json['timestamp'] = x.blocktime;
        return json;
      });
      const chatGeneral = removeDuplicatesByKey(chat, 'address');
      await setAsyncStorageValue({chatGeneral});
      this.context.setValue({chatGeneral});
    }
  }

  async refresh() {
    await this.setStateAsync({loading: true});
    await this.getMessages();
    await this.setStateAsync({loading: false});
  }

  async getLastRefreshChat() {
    try {
      const lastRefreshChat = await getAsyncStorageValue('lastRefreshChat');
      if (lastRefreshChat === null) throw 'Set First Date';
      return lastRefreshChat;
    } catch (err) {
      await setAsyncStorageValue({lastRefreshChat: 0});
      return 0;
    }
  }

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            progressBackgroundColor={mainColor}
            refreshing={this.state.loading}
            onRefresh={async () => {
              await setAsyncStorageValue({
                lastRefreshCard: Date.now().toString(),
              });
              await this.refresh();
            }}
          />
        }
        style={GlobalStyles.tab3Container}
        contentContainerStyle={[
          GlobalStyles.tab3ScrollContainer,
          {
            height: 'auto',
          },
        ]}>
        {this.context.value.chatGeneral.map((chat, i) => (
          <TouchableOpacity
            key={i}
            onLongPress={() => {
              console.log('To Be Done');
            }}
            onPress={() => {
              this.props.navigation.navigate('Chat', {
                index: i,
              });
            }}
            activeOpacity={0.6}
            style={{
              width: '100%',
              height: 'auto',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: 'row',
              marginTop: 25,
            }}>
            <View
              style={{
                backgroundColor: '#' + chat.address.substring(2, 10),
                width: 50,
                height: 50,
                borderRadius: 50,
                marginHorizontal: 20,
              }}
            />
            <View
              style={{
                width: '100%',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
              <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>
                {' '}
                {chat.address.substring(0, 12)}
                {'...'}
                {chat.address.substring(
                  chat.address.length - 10,
                  chat.address.length,
                )}
              </Text>
              <Text
                style={{color: '#cccccc', fontSize: 14, fontWeight: 'bold'}}>
                {' '}
                {chat.messages[chat.messages.length - 1].message.substring(
                  0,
                  30,
                )}
                {chat.messages[chat.messages.length - 1].message.length > 30
                  ? '...'
                  : ''}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }
}

export default Tab4;
