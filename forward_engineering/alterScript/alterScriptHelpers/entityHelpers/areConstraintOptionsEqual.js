const _ = require('lodash');
const { AlterCollectionColumnKeyOptionDto } = require('../../types/AlterCollectionDto');

/**
 * @param {Array<Partial<AlterCollectionColumnKeyOptionDto>>} oldConstraintOptions
 * @param {Array<Partial<AlterCollectionColumnKeyOptionDto>>} constraintOptions
 * @returns {boolean}
 */
const areConstraintOptionsEqual = (oldConstraintOptions = [], constraintOptions = []) => {
	return (
		oldConstraintOptions.length === constraintOptions.length &&
		_(oldConstraintOptions).differenceWith(constraintOptions, _.isEqual).isEmpty()
	);
};

module.exports = {
	areConstraintOptionsEqual,
};
