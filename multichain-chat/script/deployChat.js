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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

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
	const MultiChainChatContractsFactory = wallets.map((wallet) => new ethers.ContractFactory(abi, bytecode, wallet))
	const deployTransactions = await Promise.all(MultiChainChatContractsFactory.map((contract, index) => contract.getDeployTransaction(blockchains.chains[index].wormholeRelayer, blockchains.chains[index].chainId)))
	const gasEstimations = await Promise.all(deployTransactions.map((transaction, index) => providers[index].estimateGas(transaction)))
	const gasPrices = await Promise.all(providers.map((provider) => provider.getGasPrice()))
	console.log(gasPrices)
	const MultiChainChatContracts = await Promise.all(MultiChainChatContractsFactory.map((contract, index) => contract.deploy(blockchains.chains[index].wormholeRelayer, blockchains.chains[index].chainId, {
		gasLimit: gasEstimations[index].mul(ethers.BigNumber.from(2)),
		gasPrice:gasPrices[index]
	})))
	await Promise.all(MultiChainChatContracts.map((contract) => contract.deployTransaction.wait()))
	const deployedContractsPath = path.resolve(__dirname, '../deploy-config/deployedContracts.json');
	const deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
	MultiChainChatContracts.forEach((contract, index) => {
		deployedContracts[blockchains.chains[index].name] = {
			MultiChainChat: contract.address,
			deployedAt: new Date().getTime()
		}
	})
	fs.writeFileSync(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
	const addressByChain = []
	MultiChainChatContracts.forEach((_, index) => {
		let acc = []
		MultiChainChatContracts.forEach((contract, indexs) => {
			if (index !== indexs) {
				acc.push({ address: contract.address, chainId: blockchains.chains[indexs].chainId })
			}
		})
		addressByChain.push(acc)
	})
	for (let i = 0; MultiChainChatContracts.length > i; i++) {
		for (let j = 0; addressByChain[i].length > j; j++) {
			console.log({
				receiveChain: blockchains.chains[i].chainId,
				sourceChain: addressByChain[i][j].chainId,
				sourceContract: addressToBytes32(addressByChain[i][j].address)
			})
			const gasEstimate = await MultiChainChatContracts[i].estimateGas.setRegisteredSender(
				addressByChain[i][j].chainId,
				addressToBytes32(addressByChain[i][j].address)
			)
			const tx = await MultiChainChatContracts[i].setRegisteredSender(
				addressByChain[i][j].chainId,
				addressToBytes32(addressByChain[i][j].address),{
					gasPrice: gasPrices[i],
					gasLimit:gasEstimate.mul(ethers.BigNumber.from(2)),
				}
			)
			await tx.wait()
			await sleep(5000) // Avoid excesive use of public RPC
		}
	}
	console.log("Everything Ok")
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
