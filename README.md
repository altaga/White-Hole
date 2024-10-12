# White Hole
 
WhiteHole: Secure, mnemonic-free wallet with crosschain decentralized chat, smart savings, and easy card payments—powered by Wormhole and Circle.

<img src="./Images/thumb.png">

## Fast Links:

WALLET CODE: [CODE](./WhiteHole/)

PLAYSTORE LINK: [LINK](https://play.google.com/store/apps/details?id=com.altaga.whitehole)

VIDEODEMO: [VIDEO](pending...)

# System Diagram:

## Circle Services:

<img src="./Images/whitehole.drawio.png">

- Programmable Wallets: Para mejorar la experiencia del usuario y la seguridad en la gestión de sus crypto assets, decidimos implementar las Developer Controlled Wallets, permitiendo a los usuarios manejar sus assets de forma segura y sin el riesgo de perder sus private keys.

  - Main Account: Within the schematics you can see that we have our main wallet, which is a [Developer Controlled Wallet](https://developers.circle.com/w3s/developer-controlled-wallet-quickstart), you won’t have to worry about remembering your mnemonic because Circle protects your wallet. More details in the section [Main Account](#assets-management).

  - Savings Account: This wallet, like the previous one, is a [Developer Controlled Wallet](https://developers.circle.com/w3s/developer-controlled-wallet-quickstart), which will save the savings on each transaction according to the chosen savings protocol. More details in the section [Savings Account](#smart-savings).

  - Card Account: This wallet, like the previous one, is a [Developer Controlled Wallet](https://developers.circle.com/w3s/developer-controlled-wallet-quickstart), sin embargo a diferencia de las anteriores esta solo puede realizatr transacciones cuando es utilizada mediante la tarjeta fisica que se haya usado para crearla. More details in the section [Web3 Card](#recommended-token).

- USDC and EURC: Incorporamos stablecoins como USDC y EURC como opciones recomendables de pago, ya que mantienen una relación 1:1 con activos reales, lo que permite a los negocios y usuarios mandar y recibir crypto assets de forma segura sin arriesgarse a la volatilidad del mercado. More details in the section [Recommended Token](#recommended-token).

- Smart Contract Platform: En este caso la aplicacion ocupa gestionar informacion de diversos contratos de nuestra creacion, para poder organizar mejor los contratos que tenemos en cada red. More details in the section [SCP](#smart-contract-platform-batch-balances).

- CCTP: Utilizamos el servicio de CCTP que ya tiene integrado Wormhole como Circle Relayer. El cual nos permite de forma muy sencilla realizar Cross Chain Transfers de USDC. More details in the section [CCTP](#cctp-wormhole-integration).

## Wormhole Services:

<img src="./Images/chat.drawio.png">

- Standard Relayer: utilizamos este relayer en nuestro contrato de chat para poder realizar la comunicacion de mensajes entre chains. More details in the section [Standard Relayer](#standard-relayer).

- Circle Relayer: este segundo relayer especializado lo utilizamos debido a la facilidad de poder realizar transferencias crosschain de USDC entre las dinstintas chains que maneja nuestro proyecto. More details in the section [Circle Relayer](#cctp-wormhole-integration).
  
# Features:

## Main Account:

### Developer Controlled Wallets:

### Smart Contract Platform (Batch Balances):

## Smart Savings:

### Developer Controlled Wallets:

## Web3 Card:

### Developer Controlled Wallets:

### Recommended Token:

## MultiChainChat:

### Standard Relayer:

### CCTP Wormhole Integration:

### Smart Contract Platform (Chat Contracts):

# References:

1. https://cointelegraph.com/news/stablecoin-issuer-circle-partners-sony-blockchain-lab-usdc-expansion
2. https://medium.com/@androidcrypto/talk-to-your-credit-card-android-nfc-java-d782ff19fc4a
