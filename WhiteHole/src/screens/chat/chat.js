import {ethers} from 'ethers';
import React, {Component} from 'react';
import {
  Dimensions,
  Modal,
  NativeEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/header';
import GlobalStyles, {header, main, mainColor} from '../../styles/styles';
import {blockchains, USDCicon} from '../../utils/constants';
import ContextModule from '../../utils/contextModule';
import {setAsyncStorageValue} from '../../utils/utils';

const chatBaseState = {
  loading: false,
  chainSelectorVisible: false,
  usdcVisible: false,
  inputHeight: 'auto',
  message: '',
  amount: '',
};
const chains = blockchains.slice(1, blockchains.length);
let colorByWChainId = {};
chains.forEach(x => {
  colorByWChainId[x.wormholeChainId] = x.color;
});

export default class Chat extends Component {
  constructor(props) {
    super(props);
    this.state = chatBaseState;
    this.provider = chains.map(
      x => new ethers.providers.JsonRpcProvider(x.rpc),
    );
    this.controller = new AbortController();
    this.EventEmitter = new NativeEventEmitter();
    this.scrollView = null;
  }

  static contextType = ContextModule;

  async componentDidMount() {
    this.props.navigation.addListener('focus', async () => {
      console.log(this.props.route.name);
      this.scrollView.scrollToEnd({animated: true});
      this.EventEmitter.addListener('refresh', async () => {
        this.setState(chatBaseState);
        Keyboard.dismiss();
      });
    });
    this.props.navigation.addListener('blur', async () => {
      this.setState(chatBaseState);
      this.EventEmitter.removeAllListeners('refresh');
    });
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
        <Modal
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          }}
          visible={this.state.chainSelectorVisible}
          transparent={true}
          animationType="slide">
          <View
            style={{
              height: Dimensions.get('window').height,
              width: Dimensions.get('window').width,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
            }}>
            <View
              style={{
                marginTop: Dimensions.get('window').height * 0.2,
                height: Dimensions.get('window').height * 0.6,
                width: '100%',
                justifyContent: 'space-around',
                alignItems: 'center',
                borderWidth: 2,
                borderRadius: 25,
                borderColor: mainColor,
                backgroundColor: '#000000',
              }}>
              <View
                style={{
                  height: '40%',
                  justifyContent: 'space-evenly',
                  alignItems: 'center',
                  width: '100%',
                }}>
                <Text
                  style={{
                    color: 'white',
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    fontFamily: 'Exo2-Regular',
                    fontSize: 24,
                  }}>
                  Select Origin Chain
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    width: '100%',
                  }}>
                  {chains.map((x, i) => (
                    <Pressable
                      key={i}
                      onPress={async () => {
                        this.context.setValue({
                          fromChain: x.wormholeChainId,
                        });
                        await setAsyncStorageValue({
                          fromChain: x.wormholeChainId,
                        });
                      }}
                      style={{
                        borderColor:
                          x.wormholeChainId === this.context.value.fromChain
                            ? 'white'
                            : null,
                        borderWidth: 2,
                        borderRadius: 50,
                        padding: 6,
                      }}>
                      {x.tokens[0].icon}
                    </Pressable>
                  ))}
                </View>
              </View>
              <View
                style={{
                  height: '40%',
                  justifyContent: 'space-evenly',
                  alignItems: 'center',
                  width: '100%',
                }}>
                <Text
                  style={{
                    color: 'white',
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    fontFamily: 'Exo2-Regular',
                    fontSize: 24,
                  }}>
                  Select Destination Chain
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    width: '100%',
                  }}>
                  {chains.map((x, i) => (
                    <Pressable
                      key={i}
                      onPress={async () => {
                        this.context.setValue({
                          toChain: x.wormholeChainId,
                        });
                        setAsyncStorageValue({toChain: x.wormholeChainId});
                      }}
                      style={{
                        borderColor:
                          x.wormholeChainId === this.context.value.toChain
                            ? 'white'
                            : null,
                        borderWidth: 2,
                        borderRadius: 50,
                        padding: 6,
                      }}>
                      {x.tokens[0].icon}
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable
                onPress={() => this.setState({chainSelectorVisible: false})}
                style={[GlobalStyles.buttonStyle, {marginBottom: 12}]}>
                <Text
                  style={{
                    color: 'white',
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    fontFamily: 'Exo2-Regular',
                    fontSize: 24,
                  }}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <Modal
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          }}
          visible={this.state.usdcVisible}
          transparent={true}
          animationType="slide">
          <View
            style={{
              height: Dimensions.get('window').height,
              width: Dimensions.get('window').width,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
            }}>
            <View
              style={{
                marginTop: Dimensions.get('window').height * 0.35,
                height: Dimensions.get('window').height * 0.3,
                width: '100%',
                justifyContent: 'space-around',
                alignItems: 'center',
                borderWidth: 2,
                borderRadius: 25,
                borderColor: mainColor,
                backgroundColor: '#000000',
              }}>
              <Text style={GlobalStyles.formTitleCard}>USDC Amount</Text>
              <View
                style={{
                  width: Dimensions.get('screen').width,
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                }}>
                <View style={{width: '100%'}}>
                  <TextInput
                    onPressOut={() =>
                      this.scrollView.scrollToEnd({animated: true})
                    }
                    onChange={() =>
                      this.scrollView.scrollToEnd({animated: true})
                    }
                    onFocus={() =>
                      this.scrollView.scrollToEnd({animated: true})
                    }
                    style={[GlobalStyles.input]}
                    keyboardType="decimal-pad"
                    value={this.state.amount}
                    onChangeText={amount => {
                      this.setState({amount});
                    }}
                  />
                </View>
              </View>
              <Pressable
                onPress={() => {
                  this.setState({usdcVisible: false});
                  this.scrollView.scrollToEnd({animated: true});
                }}
                style={[GlobalStyles.buttonStyle, {marginBottom: 12}]}>
                <Text
                  style={{
                    color: 'white',
                    textAlign: 'center',
                    textAlignVertical: 'center',
                    fontFamily: 'Exo2-Regular',
                    fontSize: 24,
                  }}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <ScrollView
          ref={view => {
            this.scrollView = view;
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              progressBackgroundColor={mainColor}
              refreshing={this.state.loading}
              onRefresh={async () => {
                console.log('Refresh');
              }}
            />
          }
          style={{
            height: main,
            width: Dimensions.get('window').width,
            marginTop: header,
          }}
          contentContainerStyle={[
            GlobalStyles.tab3ScrollContainer,
            {
              height: 'auto',
              paddingHorizontal: 6,
            },
          ]}>
          {this.context.value.chatGeneral[
            this.props.route.params?.index
          ].messages.map((message, i, array) => {
            let flag = false;
            if (i !== 0) {
              flag = message.from !== array[i - 1].from;
            }
            return (
              <LinearGradient
                angle={90}
                useAngle={true}
                key={i}
                style={{
                  marginTop: flag ? 10 : 5,
                  backgroundColor:
                    message.from === this.context.value.wallets.eth.address
                      ? mainColor
                      : '#1a1a1a',
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  maxWidth: '80%',
                  alignSelf:
                    message.from === this.context.value.wallets.eth.address
                      ? 'flex-end'
                      : 'flex-start',
                }}
                colors={[
                  colorByWChainId[message.fromChainId],
                  colorByWChainId[message.toChainId],
                ]}>
                <Text style={{color: 'white', textAlign: 'justify'}}>
                  {message.message}
                </Text>
                <Text
                  style={{
                    color: '#cccccc',
                    alignSelf: 'flex-end',
                    fontSize: 12,
                    marginRight: -10,
                    marginBottom: -5,
                  }}>
                  {new Date(message.blocktime).toLocaleTimeString()}
                </Text>
              </LinearGradient>
            );
          })}
        </ScrollView>
        {parseFloat(this.state.amount ?? '0') > 0 && (
          <View
            style={{
              marginTop: 14,
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 10,
            }}>
            <Text style={{color: 'white', fontSize: 20}}>
              Amount Transferred: {this.state.amount} USDC
            </Text>
            {USDCicon}
          </View>
        )}
        <View
          style={[
            {
              height: 'auto',
              width: '100%',
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: 10,
            },
          ]}>
          <Pressable
            onPress={() => this.setState({usdcVisible: true})}
            style={{
              width: '10%',
              height: 'auto',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: mainColor,
              borderRadius: 50,
              aspectRatio: 1,
              marginBottom: 5,
            }}>
            <FontAwesome name="dollar" size={22} color="white" />
          </Pressable>
          <Pressable
            onPress={() => this.setState({chainSelectorVisible: true})}
            style={{
              width: '10%',
              height: 'auto',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: mainColor,
              borderRadius: 50,
              aspectRatio: 1,
              marginBottom: 5,
            }}>
            <Ionicons name="settings-sharp" size={22} color="white" />
          </Pressable>
          <TextInput
            onPressOut={() => this.scrollView.scrollToEnd({animated: true})}
            onChange={() => this.scrollView.scrollToEnd({animated: true})}
            onFocus={() => this.scrollView.scrollToEnd({animated: true})}
            multiline
            onContentSizeChange={async event => {
              if (event.nativeEvent.contentSize.height < 120) {
                await this.setStateAsync({
                  inputHeight: event.nativeEvent.contentSize.height,
                });
                this.scrollView.scrollToEnd({animated: true});
              }
            }}
            style={[
              GlobalStyles.inputChat,
              {
                height: this.state.inputHeight,
              },
            ]}
            keyboardType="default"
            value={this.state.message}
            onChangeText={value => {
              this.setState({message: value});
            }}
          />
          <Pressable
            style={{
              width: '10%',
              height: 'auto',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: mainColor,
              borderRadius: 50,
              aspectRatio: 1,
              marginBottom: 5,
            }}>
            <Ionicons name="send" size={22} color="white" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}
