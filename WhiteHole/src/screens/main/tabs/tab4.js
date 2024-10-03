import { ethers } from 'ethers';
import React, { Component } from 'react';
import { NativeEventEmitter, View } from 'react-native';
import { blockchains } from '../../../utils/constants';
import ContextModule from '../../../utils/contextModule';

const baseTab4State = {

};

class Tab4 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab4State;
    this.provider = blockchains.map(
      x => new ethers.providers.JsonRpcProvider(x.rpc),
    );
    this.EventEmitter = new NativeEventEmitter();
    this.controller = new AbortController();
  }
  static contextType = ContextModule;

  async componentDidMount() {
   
  }

  render() {
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
        }}>
      
      </View>
    );
  }
}

export default Tab4;
