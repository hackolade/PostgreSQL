/*
 * Copyright © 2016-2021 by IntegrIT S.A. dba Hackolade.  All rights reserved.
 *
 * The copyright to the computer software herein is the property of IntegrIT S.A.
 * The software may be used and/or copied only with the written permission of
 * IntegrIT S.A. or in accordance with the terms and conditions stipulated in
 * the agreement/contract under which the software has been supplied.
 */

const template = (modifiers = '') => new RegExp('\\$\\{(.*?)\\}', modifiers);
const getAllTemplates = str => str.match(template('gi')) || [];
const parseTemplate = str => (str.match(template('i')) || [])[1];

const assignTemplates = (str, templates) => {
	return getAllTemplates(str).reduce((result, item) => {
		const templateName = parseTemplate(item);

		return result.replace(item, () => {
			return templates[templateName] || templates[templateName] === 0 ? templates[templateName] : '';
		});
	}, str);
};

module.exports = assignTemplates;
