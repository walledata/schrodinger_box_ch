// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (utils/Counters.sol)

pragma solidity ^0.8.0;

/**
 * @title Counters
 * @author Matt Condon (@shrugs)
 * @dev Provides counters that can only be incremented, decremented or reset. This can be used e.g. to track the number
 * of elements in a mapping, issuing ERC721 ids, or counting request ids.
 *
 * Include with `using Counters for Counters.Counter;`
 */
library HashLists {

    struct HashList{
        mapping(uint256 => uint256)  entityListPointer;
        uint256[]  entityList;
    }

    function isEntity(HashList storage hashList, uint256 entityId) internal view returns (bool isIndeed) {
        if (getEntityCount(hashList) == 0) return false;
        return (hashList.entityList[hashList.entityListPointer[entityId]] == entityId);
    }

    function getEntityCount(HashList storage hashList) internal view returns (uint256 entityCount) {
        return hashList.entityList.length;
    }

    function newEntity(HashList storage hashList,uint256 entityId) internal returns (bool success) {
        if (isEntity(hashList,entityId)) return false;
        hashList.entityList.push(entityId);
        hashList.entityListPointer[entityId] = getEntityCount(hashList) - 1;
        return true;
    }

    function getEntityDataByIndex(HashList storage hashList,uint256 index) internal view returns (uint256 entityId) {
        if (index >= getEntityCount(hashList)) revert();
        uint entityId = hashList.entityList[index];
        return entityId;
    }

    function deleteEntity(HashList storage hashList,uint256 entityId) internal returns (bool success) {
        if (!isEntity(hashList,entityId)) return false;
        uint256 rowToDelete = hashList.entityListPointer[entityId];
        uint256 keyToMove = hashList.entityList[getEntityCount(hashList) - 1];
        hashList.entityList[rowToDelete] = keyToMove;
        hashList.entityListPointer[keyToMove] = rowToDelete;
        hashList.entityList.pop();
        return true;
    }



}
