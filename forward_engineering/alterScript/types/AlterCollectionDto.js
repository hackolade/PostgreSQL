class ColumnCompModField {

    /**
     * @type {string}
     */
    type

    /**
     * @type {string}
     */
    name

    /**
     * @type {string}
     */
    mode
}

class AlterCollectionColumnCompModDto {

    /**
     * @type {ColumnCompModField}
     * */
    oldField

    /**
     * @type {ColumnCompModField}
     * */
    newField

}

class AlterCollectionColumnPrimaryKeyOptionDto {
    /**
     * @type {string}
     * */
    id

    /**
     * @type {string}
     * */
    constraintName

    /**
     * @type {string}
     * */
    indexStorageParameters

    /**
     * @type {string}
     * */
    indexTablespace

    /**
     * @type {Array<{
     *     keyId: string,
     *     type?: string,
     * }>}
     * */
    indexInclude
}

class AlterCollectionColumnDto {
    /**
     * @type {string}
     */
    type

    /**
     * @type {boolean}
     */
    isActivated

    /**
     * @type {boolean}
     */
    primaryKey

    /**
     * @type {boolean}
     */
    unique

    /**
     * @type {string}
     */
    mode

    /**
     * @type {number}
     */
    length

    /**
     * @type {[
     *     "compositePartitionKey",
     *     "compositePrimaryKey",
     *     "compositeUniqueKey",
     *     "triggerUpdateColumns",
     * ]}
     */
    compositeKey

    /**
     * @type {boolean}
     */
    compositePartitionKey

    /**
     * @type {boolean}
     */
    compositePrimaryKey

    /**
     * @type {boolean}
     */
    compositeUniqueKey

    /**
     * @type {Array<AlterCollectionColumnPrimaryKeyOptionDto> | undefined}
     * */
    primaryKeyOptions

    /**
     * @type {boolean}
     */
    triggerUpdateColumns

    /**
     * @type {AlterCollectionColumnCompModDto}
     * */
    compMod

    /**
     * @type {string}
     */
    GUID
}

class AlterCollectionRoleDefinitionDto {

    /**
     * @type {string}
     */
    id

    /**
     * @type {string}
     */
    type

    /**
     * @type {Array<any>}
     */
    properties
}

class AlterCollectionRoleCompModPKDto extends AlterCollectionColumnPrimaryKeyOptionDto{

    /**
     * @type {Array<{
     *   type: string,
     *   keyId: string,
     * }>}
     * */
    compositePrimaryKey

}

class AlterCollectionRoleCompModPrimaryKey {
    /**
     * @type {AlterCollectionRoleCompModPKDto[] | undefined}
     * */
    new
    /**
     * @type {AlterCollectionRoleCompModPKDto[] | undefined}
     * */
    old

}

class AlterCollectionRoleCompModDto {
    /**
     * @type {string}
     */
    keyspaceName

    /**
     * @type {{
     *     name: string,
     *     isActivated: boolean,
     *     ifNotExist: boolean,
     * }}
     */
    bucketProperties

    /**
     * @type {{
     *     new: string,
     *     old: string,
     * }}
     */
    collectionName

    /**
     * @type {{
     *     new: boolean,
     *     old: boolean,
     * }}
     */
    isActivated

    /**
     * @type {{
     *     new: string,
     *     old: string,
     * }}
     */
    bucketId

    /**
     * @type {{
     *     new: boolean,
     *     old: boolean,
     * }}
     */
    ifNotExist

    /**
     * @type {{
     *     new: string,
     *     old: string,
     * }}
     */
    on_commit

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     */
    primaryKey

    /**
     * @type {{
     *     new: string,
     *     old: string,
     * }}
     */
    table_tablespace_name

    /**
     * @type {Array<{
     *     [propertyName: string]: AlterCollectionColumnDto
     * }>}
     */
    newProperties
}

class AlterCollectionRoleDto {

    /**
     * @type {string}
     */
    id

    /**
     * @type {"object"}
     */
    type

    /**
     * @type {string}
     */
    collectionName

    /**
     * @type {{
     *     [propertyName: string]: AlterCollectionColumnDto
     * }}
     */
    properties

    /**
     * @type {AlterCollectionRoleDefinitionDto}
     * */
    definitions

    /**
     * @type {boolean}
     */
    isActivated

    /**
     * @type {boolean}
     */
    additionalProperties

    /**
     * @type {boolean}
     */
    memory_optimized

    /**
     * @type {Array<any>}
     */
    collectionUsers

    /**
     * @type {boolean}
     */
    ifNotExist

    /**
     * @type {string}
     */
    on_commit

    /**
     * @type {string}
     */
    table_tablespace_name

    /**
     * @type {string}
     */
    bucketId

    /**
     * @type {AlterCollectionRoleCompModDto}
     * */
    compMod

    /**
     * @type {string}
     */
    name

    /**
     * @type {"entity"}
     */
    roleType

    /**
     * @type {Array<any>}
     */
    patternProperties
}

class AlterCollectionDto {

    /**
     * @type {"object"}
     */
    type

    /**
     * @type {boolean}
     */
    isActivated

    /**
     * @type {boolean}
     */
    unique

    /**
     * @type {"object"}
     */
    subtype

    /**
     * @type {{
     *     [preopertyName: string]: AlterCollectionColumnDto
     * }}
     * */
    properties

    /**
     * @type {[
     *     "compositePartitionKey",
     *     "compositePrimaryKey",
     *     "compositeUniqueKey",
     *     "triggerUpdateColumns",
     * ]}
     */
    compositeKey

    /**
     * @type {boolean}
     */
    compositePartitionKey

    /**
     * @type {boolean}
     */
    compositePrimaryKey

    /**
     * @type {boolean}
     */
    compositeUniqueKey

    /**
     * @type {boolean}
     */
    triggerUpdateColumns

    /**
     * @type {AlterCollectionRoleDto}
     * */
    role

    /**
     * @type {string}
     */
    GUID
}

module.exports = {
    AlterCollectionDto,
    AlterCollectionRoleDto,
    AlterCollectionColumnDto,
    AlterCollectionRoleCompModPrimaryKey,
    AlterCollectionRoleCompModPKDto,
}
