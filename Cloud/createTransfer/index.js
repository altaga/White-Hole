const functions = require('@google-cloud/functions-framework');
const {
  initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");
const { apiKey, entitySecret } = require("./secrets");
const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
  apiKey,
  entitySecret,
});
const crypto = require("crypto");
const Firestore = require("@google-cloud/firestore");
const { abiERC20, tokens } = require("./constants.js");
const ethers = require("ethers");

const privateKey = ``; 

const db = new Firestore({
  projectId: "whitehole-XXXXXXXXXXXXX",
  keyFilename: "credential.json",
});

const chains = ["eth", "avax", "pol", "arb"];
const blockchains = ["ETH", "AVAX", "MATIC", "ARB"];

functions.http('helloHttp', async (req, res) => {
    try {
        const decrypted = decryptText(req.body.user).toString()
        let collection;
        let query;
        if(decrypted.indexOf("user_")>=0){
            collection = db.collection("Accounts");
            query = await collection.where(
                "user",
                "==",
                decrypted
            ).get();
        }
        else if(decrypted.indexOf("saving_")>=0){
            collection = db.collection("Savings");
            query = await collection.where(
                "user",
                "==",
                decrypted
            ).get();
        }
        else if(decrypted.indexOf("card_")>=0){
            collection = db.collection("Cards");
            query = await collection.where(
                "user",
                "==",
                decrypted
            ).get();
        }
        else if(req.body.card ? true : false){
            collection = db.collection("Cards");
            query = await collection.where(
                "cardHash",
                "==",
                decrypted
            ).get();
        }
        else{
            throw "Bad User";
        }
        if (query.empty) {
            throw "Query Empty";
        }
        else{
            let txHash = "";
            const command = req.body.command;
            const chain = chains[req.body.chain];
            const token = tokens[req.body.chain][req.body.token];
            const amount = req.body.amount;
            const destinationAddress = req.body.destinationAddress;
            const walletId = query.docs[0].data().wallets[chain].id;
            console.log({token, walletId, amount})
            if(command === 'transfer'){
                const transaction = {
                    amount: [amount],
                    destinationAddress,
                    walletId,
                    blockchain: blockchains[req.body.chain],
                };
                let response = await circleDeveloperSdk.createTransaction({
                    ...transaction,
                    fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM",
                    },
                    },
                });
                const { id } = response.data;
                txHash = await new Promise((resolve) => {
                    const interval = setInterval(async () => {
                    response = await circleDeveloperSdk.getTransaction({
                        id,
                    });
                    if (response.data.transaction?.txHash) {
                        clearInterval(interval);
                        resolve(response.data.transaction.txHash);
                    }
                    }, 1000);
                });
            }
            else if(command === 'tokenTransfer'){
                const interface = new ethers.utils.Interface(abiERC20);
                const transaction = interface.encodeFunctionData("transfer", [
                    destinationAddress,
                    ethers.utils.parseUnits(amount, token.decimals),
                ]);
                let response = await circleDeveloperSdk.createContractExecutionTransaction({
                    walletId,
                    callData: transaction,
                    contractAddress: token.address,
                    fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM",
                    },
                    },
                });
                console.log(response)
                const { id } = response.data;
                txHash = await new Promise((resolve) => {
                    const interval = setInterval(async () => {
                    response = await circleDeveloperSdk.getTransaction({
                        id,
                    });
                    if (response.data.transaction?.txHash) {
                        clearInterval(interval);
                        resolve(response.data.transaction.txHash);
                    }
                    }, 1000);
                });
            }
            else{
                throw "Bad Command"
            }
            res.send({
                error:null,
                result:txHash
            });
        }
    }
    catch(e){
        console.log(e)
        res.send({
            error:e,
            result:null
        });
    }
});


function decryptText(encryptedText) {
  return crypto.privateDecrypt(
    {
      key: privateKey,
    },
    Buffer.from(encryptedText, "base64")
  );
}