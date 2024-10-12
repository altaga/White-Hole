const functions = require('@google-cloud/functions-framework');
const {
    initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");
const {
    apiKey,
    entitySecret
} = require("./secrets");
const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
});
const crypto = require("crypto");
const Firestore = require("@google-cloud/firestore");
const {
    abiMultiChainChat,
    abiCircleRelayer,
    chains,
    chainSelector,
    chatSelector,
    abiERC20,
    usdcSelector
} = require("./constants.js");
const ethers = require("ethers");

const circleRelayerAddress = '0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2'; // Same on all chains

const privateKey = `xxxxxxxx`;

const db = new Firestore({
    projectId: "whitehole-XXXXXXXXXXXXX",
    keyFilename: "credential.json",
});

functions.http('helloHttp', async (req, res) => {
    try {
        const decrypted = decryptText(req.body.user).toString()
        const fromChain = req.body.fromChain;
        const toChain = req.body.toChain;
        const data = req.body.data;
        const amount = ethers.utils.parseUnits(req.body.usdc, 6);
        const to = req.body.to;
        let collection;
        let query;
        if (decrypted.indexOf("user_") >= 0) {
            collection = db.collection("Accounts");
            query = await collection.where(
                "user",
                "==",
                decrypted
            ).get();
        } else {
            throw "Bad User";
        }
        if (query.empty) {
            throw "Query Empty";
        } else {
            let txHash = "";
            const provider = new ethers.providers.JsonRpcProvider(chains[fromChain])
            const chat = new ethers.Contract(
                chatSelector[fromChain],
                abiMultiChainChat,
                provider
            )
            const walletId = query.docs[0].data().wallets[chainSelector[fromChain]].id;
            const crossChainFlag = fromChain !== toChain;
            let myamount = "0";
            if (crossChainFlag) {
                const gas_limit = 700_000
                const quote = await chat.quoteCrossChainCost(toChain, gas_limit);
                myamount = ethers.utils.formatEther(quote)
                if(parseFloat(req.body.usdc)>0){
                    let interface = new ethers.utils.Interface(abiERC20);
                    let transaction = interface.encodeFunctionData("approve", [
                        circleRelayerAddress,
                        amount
                    ]);
                    let response = await circleDeveloperSdk.createContractExecutionTransaction({
                        walletId,
                        callData: transaction,
                        contractAddress: usdcSelector[fromChain],
                        fee: {
                            type: "level",
                            config: {
                                feeLevel: "MEDIUM",
                            },
                        },
                    });
                    const { id: myId } = response.data;
                    await new Promise((resolve) => {
                        const interval = setInterval(async () => {
                            response = await circleDeveloperSdk.getTransaction({
                                id:myId,
                            });
                            if (response.data.transaction.state === "CONFIRMED") {
                                clearInterval(interval);
                                resolve(response.data.transaction.txHash);
                            }
                        }, 1000);
                    });
                    interface = new ethers.utils.Interface(abiCircleRelayer);
                    transaction = interface.encodeFunctionData("transferTokensWithRelay", [
                        usdcSelector[fromChain],
                        amount,
                        0,
                        toChain,
                        addressToBytes32(to)
                    ]);
                    response = await circleDeveloperSdk.createContractExecutionTransaction({
                        walletId,
                        callData: transaction,
                        contractAddress: circleRelayerAddress,
                        fee: {
                            type: "level",
                            config: {
                                feeLevel: "MEDIUM",
                            },
                        },
                    });
                    const { id: myId2 } = response.data;
                    await new Promise((resolve) => {
                        const interval = setInterval(async () => {
                            response = await circleDeveloperSdk.getTransaction({
                                id: myId2,
                            });
                            if (response.data.transaction?.txHash) {
                                clearInterval(interval);
                                resolve(response.data.transaction.txHash);
                            }
                        }, 1000);
                    });
                }
            }else{
                if(parseFloat(req.body.usdc)>0){
                    let interface = new ethers.utils.Interface(abiERC20);
                    let transaction = interface.encodeFunctionData("transfer", [
                        to,
                        amount
                    ]);
                    let response = await circleDeveloperSdk.createContractExecutionTransaction({
                        walletId,
                        callData: transaction,
                        contractAddress: usdcSelector[fromChain],
                        fee: {
                            type: "level",
                            config: {
                                feeLevel: "MEDIUM",
                            },
                        },
                    });
                    let id = response.data.id;
                    await new Promise((resolve) => {
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
            }
            let response = await circleDeveloperSdk.createContractExecutionTransaction({
                walletId,
                amount: myamount,
                callData: data,
                contractAddress: chatSelector[fromChain],
                fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM",
                    },
                },
            });
            const {
                id
            } = response.data;
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
            res.send({
                error: null,
                result: txHash
            });
        }
    } catch (e) {
        console.log(e)
        res.send({
            error: e,
            result: null
        });
    }
});


function decryptText(encryptedText) {
    return crypto.privateDecrypt({
            key: privateKey,
        },
        Buffer.from(encryptedText, "base64")
    );
}

function addressToBytes32(address) {
    address = address.toLowerCase();
    if (address.startsWith("0x")) {
        address = address.slice(2);
    }
    return '0x' + address.padStart(64, '0');
}