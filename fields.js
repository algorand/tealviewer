var fieldNames = {
  "Global": {
    "GroupSize": false
  },
  "Transaction": {
    "TypeEnum": false,
    "GroupIndex": false,
    "Header": {
      "Sender": false,
      "Fee": false,
      "FirstValid": false,
      "LastValid": false,
      "Note": false,
      "GenesisID": false,
      "GenesisHash": false,
      "Group": false,
      "Lease": false
    },
    "KeyregTxnFields": {
      "VotePK": false,
      "SelectionPK": false,
      "VoteFirst": false,
      "VoteLast": false,
      "VoteKeyDilution": false,
      "Nonparticipation": false
    },
    "PaymentTxnFields": {
      "Receiver": false,
      "Amount": false,
      "CloseRemainderTo": false
    },
    "AssetConfigTxnFields": {
      "ConfigAsset": false,
      "AssetParams": {
        "Total": false,
        "DefaultFrozen": false,
        "UnitName": false,
        "AssetName": false,
        "URL": false,
        "MetadataHash": false,
        "Manager": false,
        "Reserve": false,
        "Freeze": false,
        "Clawback": false
      }
    },
    "AssetTransferTxnFields": {
      "XferAsset": false,
      "AssetAmount": false,
      "AssetSender": false,
      "AssetReceiver": false,
      "AssetCloseTo": false
    },
    "AssetFreezeTxnFields": {
      "FreezeAccount": false,
      "FreezeAsset": false,
      "AssetFrozen": false
    },
    "ApplicationCallTxnFields": {
      "ApplicationID": false,
      "OnCompletion": false,
      "ApplicationArgs": false,
      "Accounts": false,
      "ApprovalProgram": false,
      "ClearStateProgram": false
    }
  }
};
