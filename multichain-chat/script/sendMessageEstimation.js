const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const crypto = require('crypto');

// YOUR ENCRYPTION ALGORITHM
function encrypt(plaintext, _secret, myIV = null) {
	const secret = ethers.utils.getAddress(_secret)
	// Create a key from the secret using SHA-256 (32 bytes for AES-256)
	const key = crypto.createHash('sha256').update(secret).digest();

	// Generate a random 16-byte IV
	const iv = myIV===null ? crypto.randomBytes(16) : Buffer.from(myIV, 'base64');

	// Create the cipher object
	const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

	// Encrypt the plaintext
	let encrypted = cipher.update(plaintext, 'utf8', 'base64');
	encrypted += cipher.final('base64');

	// Return IV + encrypted text, separated by ':'
	return [iv.toString('base64'), encrypted]
}

async function main() {
	// Load the chain configuration and deployed contract addresses
	const chains = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../deploy-config/chains.json'))
	);
	const deployedContracts = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../deploy-config/deployedContracts.json'))
	);

	console.log('Sender Contract Address: ', deployedContracts.avax.MultiChainChat);
	console.log('Receiver Contract Address: ', deployedContracts.pol.MultiChainChat);
	console.log('...');

	// Get the Avalanche Fuji configuration
	const avaxChain = chains.chains.find((chain) =>
		chain.description.includes("Avalanche")
	);
	const polChain = chains.chains.find((chain) =>
		chain.description.includes("Polygon")
	);

	// Set up the provider and wallet
	const provider = new ethers.providers.JsonRpcProvider(avaxChain.rpc);
	const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

	// Load the ABI of the MessageSender contract
	const messageSenderJson = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../out/MultiChainChat.sol/MultiChainChat.json'), 'utf8')
	);

	const abi = messageSenderJson.abi;

	// Create a contract instance for MessageSender
	const MessageSender = new ethers.Contract(
		deployedContracts.avax.MultiChainChat, // Automatically use the deployed address
		abi,
		wallet
	);

	// Define the target chain and target address (the Arb receiver contract)
	const targetChain = polChain.chainId; // Wormhole chain ID for Arb Sepolia
	const targetAddress = deployedContracts.pol.MultiChainChat; // Automatically use the deployed address

	// The message you want to send
	const message = 'Hello from Avalanche to Polygon! Crosschain';
	const to = "0xd871d276c8dba0daa93828ce87f9f064bf4bfe38"
	const [iv, messFrom] = await encrypt(message, wallet.address)
	const [_, messTo] = await encrypt(message, to, iv)
	const gas_limit = 700_000

	// Dynamically quote the cross-chain cost
	const txCost = await MessageSender.quoteCrossChainCost(targetChain, gas_limit);

	// Send the message (make sure to send enough gas in the transaction)
	const gasEstimation = await MessageSender.estimateGas.sendMessage(targetChain, targetAddress, gas_limit, to, messFrom, messTo, iv, ethers.utils.parseUnits("0", 6), {
		value: txCost,
	});
	const gasPrice = await provider.getGasPrice()
	console.log(ethers.utils.formatEther(gasPrice.mul(gasEstimation).add(txCost)))
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});