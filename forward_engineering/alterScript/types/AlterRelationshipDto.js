class AlterRelationshipFKField {

    /**
     * @type {boolean}
     */
    isActivated

    /**
     * @type {string}
     */
    name
}

class AlterRelationshipParentDto {

    /**
     * @type {{
     *     name: string,
     *     isActivated: boolean
     * }}
     */
    bucket

    /**
     * @type {{
     *     name: string,
     *     isActivated: boolean,
     *     fkFields: Array<AlterRelationshipFKField>
     * }}
     */
    collection
}

class AlterRelationshipChildDto {

    /**
     * @type {{
     *     name: string,
     *     isActivated: boolean
     * }}
     */
    bucket

    /**
     * @type {{
     *     name: string,
     *     isActivated: boolean,
     *     fkFields: Array<AlterRelationshipFKField>
     * }}
     */
    collection
}

class AlterRelationshipCustomProperties {

    /**
     * @type {string}
     */
    relationshipOnDelete

    /**
     * @type {string}
     */
    relationshipOnUpdate

    /**
     * @type {string}
     */
    relationshipMatch

}

class AlterRelationshipRoleCompModDto {

    /**
     * @type {boolean}
     */
    created

    /**
     * @type {boolean}
     */
    deleted

    /**
     * @type {boolean | undefined}
     */
    modified

    /**
     * @type {AlterRelationshipParentDto}
     * */
    parent

    /**
     * @type {AlterRelationshipChildDto}
     * */
    child

    /**
     * @type {{
     *     new: string,
     *     old: string,
     * } | undefined}
     */
    name

    /**
     * @type {{
     *     new: string,
     *     old: string,
     * } | undefined}
     */
    description

    /**
     * @type {{
     *     old?: AlterRelationshipCustomProperties,
     *     new?: AlterRelationshipCustomProperties
     * } | undefined}
     * */
    customProperties

    /**
     * @type {{
     *     new?: boolean,
     *     old?: boolean,
     * }}
     */
    isActivated
}

class AlterRelationshipRoleDto {

    /**
     * @type {string}
     */
    id

    /**
     * @type {string}
     */
    name

    /**
     * @type {"Foreign Key"}
     */
    relationshipType

    /**
     * @type {Array<Array<string>>}
     */
    parentField

    /**
     * @type {string}
     */
    parentCardinality

    /**
     * @type {Array<Array<string>>}
     */
    childField

    /**
     * @type {boolean}
     */
    isActivated

    /**
     * @type {string}
     */
    childCardinality

    /**
     * @type {string}
     */
    parentCollection

    /**
     * @type {string}
     */
    childCollection

    /**
     * @type {Object}
     */
    hackoladeStyles

    /**
     * @type {AlterRelationshipRoleCompModDto}
     * */
    compMod

    /**
     * @type {"relationship"}
     */
    roleType
}

class AlterRelationshipDto {

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
     * @type {AlterRelationshipRoleDto}
     */
    role

    /**
     * @type {string}
     */
    GUID

}


module.exports = {
    AlterRelationshipRoleCompModDto,
    AlterRelationshipRoleDto,
    AlterRelationshipDto,
    AlterRelationshipFKField,
    AlterRelationshipParentDto,
    AlterRelationshipChildDto,
    AlterRelationshipCustomProperties
}
