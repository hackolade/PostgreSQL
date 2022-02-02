module.exports = () => {
	const getLocaleProperties = modelData => {
		const isSupportsLocale = ['v13.x', 'v14.x'].includes(modelData.dbVersion);

		if (isSupportsLocale && modelData.locale) {
			return { locale: modelData.locale };
		} else if (!isSupportsLocale && modelData.locale) {
			return {
				collate: modelData.locale,
				characterClassification: modelData.locale,
			};
		} else {
			return {
				collate: modelData.collate,
				characterClassification: modelData.characterClassification,
			};
		}
	};

	return {
		getLocaleProperties,
	};
};
