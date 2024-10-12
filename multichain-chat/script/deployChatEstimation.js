const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function addressToBytes32(address) {
	// Ensure the address is in lower case for consistent formatting
	address = address.toLowerCase();

	// Remove the '0x' prefix if present
	if (address.startsWith("0x")) {
		address = address.slice(2);
	}

	// Pad the address with leading zeros to make it 32 bytes (64 hex characters)
	return '0x' + address.padStart(64, '0');
}

var myHeaders = new Headers();
myHeaders.append('accept', 'application/json');
var requestOptions = {
	method: 'GET',
	headers: myHeaders,
	redirect: 'follow',
};

async function main() {
	const blockchains = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../deploy-config/chains.json'))
	);
	const providers = blockchains.chains.map((chain) => new ethers.providers.JsonRpcProvider(chain.rpc))
	const wallets = providers.map((provider) => new ethers.Wallet(process.env.PRIVATE_KEY, provider))
	const multiChainChatJson = JSON.parse(
		fs.readFileSync(
			path.resolve(__dirname, '../out/MultiChainChat.sol/MultiChainChat.json'),
			'utf8'
		)
	);
	const abi = multiChainChatJson.abi;
	const bytecode = multiChainChatJson.bytecode;
	const MultiChainChatContract = wallets.map((wallet) => new ethers.ContractFactory(abi, bytecode, wallet))
	const gasPrices = await Promise.all(providers.map((provider) => provider.getGasPrice()))
	const deployTransactions = await Promise.all(MultiChainChatContract.map((contract, index) => contract.getDeployTransaction(blockchains.chains[index].wormholeRelayer, blockchains.chains[index].chainId)))
	const gasEstimations = await Promise.all(deployTransactions.map((transaction, index) => providers[index].estimateGas(transaction)))
	const gasFees = gasPrices.map((gasPrice, index) => ethers.utils.formatEther(gasPrice.mul(gasEstimations[index])))
	const array = blockchains.chains
		.map(chain => chain.coingecko)
	const response = await fetch(
		`https://api.coingecko.com/api/v3/simple/price?ids=${array.toString()}&vs_currencies=usd`,
		requestOptions,
	);
	const result = await response.json();
	const usdConversionTemp = array.map(x => result[x].usd);
	console.log(gasFees.map((gas, index) => {
		return {
			chain: blockchains.chains[index].description,
			gasTotal:gas,
			gas:gasEstimations[index].toNumber(),
			gasPrice: gasPrices[index].toNumber(),
			usd: usdConversionTemp[index] * gas
		}
	}))
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
