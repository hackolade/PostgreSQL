const _ = require('lodash');
const { getModifyViewCommentsScriptDtos } = require('./viewHelpers/commentsHelper');
const { AlterScriptDto } = require('../types/AlterScriptDto');
const { wrapInQuotes } = require('../../utils/general');

const getKeys = ({ view, collectionRefsDefinitionsMap, ddlProvider, app }) => {
	const { mapProperties } = app.require('@hackolade/ddl-fe-utils');

	return mapProperties(view, (propertyName, schema) => {
		const definition = collectionRefsDefinitionsMap[schema.refId];

		if (!definition) {
			return ddlProvider.hydrateViewColumn({
				name: propertyName,
				isActivated: schema.isActivated,
			});
		}

		const entityName =
			_.get(definition.collection, '[0].code', '') ||
			_.get(definition.collection, '[0].collectionName', '') ||
			'';
		const dbName = _.get(definition.bucket, '[0].code') || _.get(definition.bucket, '[0].name', '');
		const name = definition.name;

		if (name === propertyName) {
			return ddlProvider.hydrateViewColumn({
				name,
				dbName,
				entityName,
				isActivated: schema.isActivated,
			});
		}

		return ddlProvider.hydrateViewColumn({
			name,
			dbName,
			entityName,
			alias: propertyName,
			isActivated: schema.isActivated,
		});
	});
};

/**
 * @return {(view: Object) => AlterScriptDto | undefined}
 * */
const getAddViewScriptDto = app => view => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const viewData = {
		name: view.code || view.name,
		keys: getKeys({
			view,
			collectionRefsDefinitionsMap: view.compMod?.collectionData?.collectionRefsDefinitionsMap ?? {},
			ddlProvider,
			app,
		}),
		schemaData: { schemaName: '' },
	};
	const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

	const script = ddlProvider.createView(hydratedView, {}, view.isActivated);
	return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @return {(view: Object) => AlterScriptDto | undefined}
 * */
const getDeleteViewScriptDto = app => view => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const viewName = wrapInQuotes(view.code || view.name);

	const script = ddlProvider.dropView(viewName);
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @param {Object} view
 * @return {AlterScriptDto[]}
 * */
const getModifyViewScriptDtos = view => {
	const modifyCommentsScriptDtos = getModifyViewCommentsScriptDtos(view);

	return [...modifyCommentsScriptDtos].filter(Boolean);
};

module.exports = {
	getAddViewScriptDto,
	getDeleteViewScriptDto,
	getModifyViewScriptDtos,
};
