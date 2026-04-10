const {validateAdminArgs} = require("firebase-admin/data-connect");

const connectorConfig = {
  connector: "example",
  serviceId: "theiotankv200",
  location: "us-east4",
};
exports.connectorConfig = connectorConfig;

function createAlert(dcOrVarsOrOptions, varsOrOptions, options) {
  const {dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation("CreateAlert", inputVars, inputOpts);
}
exports.createAlert = createAlert;

function listPublicDashboards(dcOrOptions, options) {
  const {dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery("ListPublicDashboards", undefined, inputOpts);
}
exports.listPublicDashboards = listPublicDashboards;

function updateWidgetConfiguration(dcOrVarsOrOptions, varsOrOptions, options) {
  const {dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation("UpdateWidgetConfiguration", inputVars, inputOpts);
}
exports.updateWidgetConfiguration = updateWidgetConfiguration;

function getDataSourceDetails(dcOrVarsOrOptions, varsOrOptions, options) {
  const {dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery("GetDataSourceDetails", inputVars, inputOpts);
}
exports.getDataSourceDetails = getDataSourceDetails;

