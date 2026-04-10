import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface Alert_Key {
  id: UUIDString;
  __typename?: 'Alert_Key';
}

export interface CreateAlertData {
  alert_insert: Alert_Key;
}

export interface CreateAlertVariables {
  dataSourceId: UUIDString;
  userId: UUIDString;
  condition: string;
  message: string;
  name: string;
  triggerType: string;
}

export interface Dashboard_Key {
  id: UUIDString;
  __typename?: 'Dashboard_Key';
}

export interface DataSource_Key {
  id: UUIDString;
  __typename?: 'DataSource_Key';
}

export interface GetDataSourceDetailsData {
  dataSource?: {
    id: UUIDString;
    name: string;
    description?: string | null;
    collectionPath: string;
    createdAt: TimestampString;
    lastSyncAt?: TimestampString | null;
  } & DataSource_Key;
}

export interface GetDataSourceDetailsVariables {
  id: UUIDString;
}

export interface ListPublicDashboardsData {
  dashboards: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    owner: {
      id: UUIDString;
      displayName: string;
    } & User_Key;
  } & Dashboard_Key)[];
}

export interface UpdateWidgetConfigurationData {
  widget_update?: Widget_Key | null;
}

export interface UpdateWidgetConfigurationVariables {
  id: UUIDString;
  configuration: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

export interface Widget_Key {
  id: UUIDString;
  __typename?: 'Widget_Key';
}

/** Generated Node Admin SDK operation action function for the 'CreateAlert' Mutation. Allow users to execute without passing in DataConnect. */
export function createAlert(dc: DataConnect, vars: CreateAlertVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAlertData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAlert' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAlert(vars: CreateAlertVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAlertData>>;

/** Generated Node Admin SDK operation action function for the 'ListPublicDashboards' Query. Allow users to execute without passing in DataConnect. */
export function listPublicDashboards(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublicDashboardsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPublicDashboards' Query. Allow users to pass in custom DataConnect instances. */
export function listPublicDashboards(options?: OperationOptions): Promise<ExecuteOperationResponse<ListPublicDashboardsData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateWidgetConfiguration' Mutation. Allow users to execute without passing in DataConnect. */
export function updateWidgetConfiguration(dc: DataConnect, vars: UpdateWidgetConfigurationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWidgetConfigurationData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateWidgetConfiguration' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateWidgetConfiguration(vars: UpdateWidgetConfigurationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWidgetConfigurationData>>;

/** Generated Node Admin SDK operation action function for the 'GetDataSourceDetails' Query. Allow users to execute without passing in DataConnect. */
export function getDataSourceDetails(dc: DataConnect, vars: GetDataSourceDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDataSourceDetailsData>>;
/** Generated Node Admin SDK operation action function for the 'GetDataSourceDetails' Query. Allow users to pass in custom DataConnect instances. */
export function getDataSourceDetails(vars: GetDataSourceDetailsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetDataSourceDetailsData>>;

