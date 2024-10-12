// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "lib/wormhole-solidity-sdk/src/interfaces/IWormholeRelayer.sol";
import "lib/wormhole-solidity-sdk/src/interfaces/IWormholeReceiver.sol";

contract MultiChainChat is IWormholeReceiver {
    // Wormhole Settings
    IWormholeRelayer public wormholeRelayer;
    uint16 public wormholeChainId;
    mapping(uint16 => bytes32) public registeredSenders;
    // Owner
    address public owner;
    // Wormhole events
    event MessageReceived(string message);
    event SourceChainLogged(uint16 sourceChain);

    // Chat Settings
    uint256 public counter;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _; // Close Modifier
    }

    struct Message {
        uint16 fromChainId;
        uint16 toChainId;
        address from;
        address to;
        string messFrom;
        string messTo;
        string iv;
        uint256 amount;
        uint256 blocktime;
    }

    mapping(address => Message[]) public chatHistory;
    mapping(address => uint256) public chatCounter;

    // Smart Contract Constructor
    constructor(address _wormholeRelayer, uint16 _wormholeChainId) {
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        wormholeChainId = _wormholeChainId;
        owner = msg.sender;
    }

    // Same Chain

    function addMessage(
        address to,
        uint256 amount,
        string memory messFrom,
        string memory messTo,
        string memory iv
    ) public payable {
        uint16 fromChainId = wormholeChainId;
        uint16 toChainId = wormholeChainId;
        address from = msg.sender;
        counter += 1;
        chatCounter[from] += 1;
        chatHistory[from].push(
            Message(
                fromChainId,
                toChainId,
                from,
                to,
                messFrom,
                messTo,
                iv,
                amount,
                block.timestamp
            )
        );
        chatCounter[to] += 1;
        chatHistory[to].push(
            Message(
                fromChainId,
                toChainId,
                from,
                to,
                messFrom,
                messTo,
                iv,
                amount,
                block.timestamp
            )
        );
    }

    // Crosschain Chat

    function addMessageWormhole(Message memory input) internal {
        counter += 1;
        chatCounter[input.to] += 1;
        chatHistory[input.to].push(input);
        chatCounter[input.from] += 1;
        chatHistory[input.from].push(input);
    }

    // Message Sender

    function quoteCrossChainCost(
        uint16 targetChain,
        uint256 _GAS_LIMIT
    ) public view returns (uint256 cost) {
        (cost, ) = wormholeRelayer.quoteEVMDeliveryPrice(
            targetChain,
            0,
            _GAS_LIMIT
        );
    }

    function sendMessage(
        uint16 targetChain,
        address targetAddress,
        uint256 _GAS_LIMIT,
        // Chat Data
        address to,
        string memory messFrom,
        string memory messTo,
        string memory iv,
        uint256 amount
    ) external payable {
        uint256 cost = quoteCrossChainCost(targetChain, _GAS_LIMIT); // Dynamically calculate the cross-chain cost
        require(
            msg.value >= cost,
            "Insufficient funds for cross-chain delivery"
        );
        wormholeRelayer.sendPayloadToEvm{value: cost}(
            targetChain,
            targetAddress,
            abi.encode(
                wormholeChainId,
                targetChain,
                msg.sender,
                to,
                messFrom,
                messTo,
                iv,
                amount,
                block.timestamp
            ),
            0, // No receiver value needed
            _GAS_LIMIT // Gas limit for the transaction
        );
    }

    // Receiver

    // Modifier to check if the sender is registered for the source chain
    modifier isRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) {
        require(
            registeredSenders[sourceChain] == sourceAddress,
            "Not registered sender"
        );
        _;
    }

    // Function to register the valid sender address for a specific chain
    function setRegisteredSender(
        uint16 sourceChain,
        bytes32 sourceAddress
    ) public {
        require(msg.sender == owner, "Not allowed to set registered sender");
        registeredSenders[sourceChain] = sourceAddress;
    }

    // Update receiveWormholeMessages to include the source address check
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory, // additional VAAs (optional, not needed here)
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 // delivery hash
    ) public payable override isRegisteredSender(sourceChain, sourceAddress) {
        require(
            msg.sender == address(wormholeRelayer),
            "Only the Wormhole relayer can call this function"
        );
        // Decode the payload to extract the message
        (
            uint16 fromChainId,
            uint16 toChainId,
            address from,
            address to,
            string memory messFrom,
            string memory messTo,
            string memory iv,
            uint256 amount,
            uint256 blocktime
        ) = abi.decode(
                payload,
                (uint16, uint16, address, address, string, string, string, uint256, uint256)
            );
        // Setup Struct
        Message memory message = Message(
            fromChainId,
            toChainId,
            from,
            to,
            messFrom,
            messTo,
            iv,
            amount,
            blocktime
        );
        // Add Message to Chat
        addMessageWormhole(message);

        // Example use of sourceChain for logging
        if (sourceChain != 0) {
            emit SourceChainLogged(sourceChain);
        }

        // Emit an event with the received message
        emit MessageReceived(message.iv);
    }

    // Garbage Collector
    function garbage() public payable onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
