import type {
	IExecuteFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError } from 'n8n-workflow';

import {
	dashboardFields,
	dashboardOperations,
	teamFields,
	teamMemberFields,
	teamMemberOperations,
	teamOperations,
	userFields,
	userOperations,
	panelOperations,
	panelFields,
} from './descriptions';
import { deriveUid, grafanaApiRequest, throwOnEmptyUpdate } from './GenericFunctions';
import type {
	DashboardUpdateFields,
	DashboardUpdatePayload,
	LoadedDashboards,
	LoadedFolders,
	LoadedTeams,
	LoadedUsers,
} from './types';

export class Grafana implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Grafana',
		name: 'grafana',
		icon: 'file:grafana.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the Grafana API',
		defaults: {
			name: 'Grafana',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'grafanaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				noDataExpression: true,
				type: 'options',
				options: [
					{
						name: 'Panel',
						value: 'panel',
					},
					{
						name: 'Dashboard',
						value: 'dashboard',
					},
					{
						name: 'Team',
						value: 'team',
					},
					{
						name: 'Team Member',
						value: 'teamMember',
					},
					{
						name: 'User',
						value: 'user',
					},
				],
				default: 'dashboard',
			},
			...dashboardOperations,
			...dashboardFields,
			...teamOperations,
			...teamFields,
			...teamMemberOperations,
			...teamMemberFields,
			...userOperations,
			...userFields,
			...panelOperations,
			...panelFields,
		],
	};

	methods = {
		loadOptions: {
			async getDashboards(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const dashboards = (await grafanaApiRequest.call(
					this,
					'GET',
					'/search',
					{},
					{ qs: 'dash-db' },
				)) as LoadedDashboards;
				return dashboards.map(({ id, title }) => ({ value: id, name: title }));
			},

			async getFolders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const folders = (await grafanaApiRequest.call(this, 'GET', '/folders')) as LoadedFolders;
				return folders.map(({ id, title }) => ({ value: id, name: title }));
			},

			async getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = (await grafanaApiRequest.call(this, 'GET', '/teams/search')) as LoadedTeams;
				return res.teams.map(({ id, name }) => ({ value: id, name }));
			},

			async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const users = (await grafanaApiRequest.call(this, 'GET', '/org/users')) as LoadedUsers;
				return users.map(({ userId, email }) => ({ value: userId, name: email }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		let responseData;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'dashboard') {
					// **********************************************************************
					//                               dashboard
					// **********************************************************************

					if (operation === 'create') {
						// ----------------------------------------
						//            dashboard: create
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/dashboard/#create--update-dashboard

						const body = {
							dashboard: {
								id: null,
								title: this.getNodeParameter('title', i),
							},
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							if (additionalFields.folderId === '') delete additionalFields.folderId;

							Object.assign(body, additionalFields);
						}

						responseData = await grafanaApiRequest.call(this, 'POST', '/dashboards/db', body);
					} else if (operation === 'delete') {
						// ----------------------------------------
						//            dashboard: delete
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/dashboard/#delete-dashboard-by-uid

						const uidOrUrl = this.getNodeParameter('dashboardUidOrUrl', i) as string;
						const uid = deriveUid.call(this, uidOrUrl);
						const endpoint = `/dashboards/uid/${uid}`;
						responseData = await grafanaApiRequest.call(this, 'DELETE', endpoint);
					} else if (operation === 'get') {
						// ----------------------------------------
						//              dashboard: get
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/dashboard/#get-dashboard-by-uid

						const uidOrUrl = this.getNodeParameter('dashboardUidOrUrl', i) as string;
						const uid = deriveUid.call(this, uidOrUrl);
						const endpoint = `/dashboards/uid/${uid}`;
						responseData = await grafanaApiRequest.call(this, 'GET', endpoint);
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//            dashboard: getAll
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/folder_dashboard_search/#search-folders-and-dashboards

						const qs = {
							type: 'dash-db',
						};

						const filters = this.getNodeParameter('filters', i);

						if (Object.keys(filters).length) {
							Object.assign(qs, filters);
						}

						const returnAll = this.getNodeParameter('returnAll', i);

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i);
							Object.assign(qs, { limit });
						}

						responseData = await grafanaApiRequest.call(this, 'GET', '/search', {}, qs);
					} else if (operation === 'update') {
						// ----------------------------------------
						//            dashboard: update
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/dashboard/#create--update-dashboard

						const uidOrUrl = this.getNodeParameter('dashboardUidOrUrl', i) as string;
						const uid = deriveUid.call(this, uidOrUrl);

						// ensure dashboard to update exists
						await grafanaApiRequest.call(this, 'GET', `/dashboards/uid/${uid}`);

						const body: DashboardUpdatePayload = {
							overwrite: true,
							dashboard: { uid },
						};

						const updateFields = this.getNodeParameter('updateFields', i) as DashboardUpdateFields;

						throwOnEmptyUpdate.call(this, resource, updateFields);

						const { title, ...rest } = updateFields;

						if (!title) {
							const { dashboard } = await grafanaApiRequest.call(
								this,
								'GET',
								`/dashboards/uid/${uid}`,
							);
							body.dashboard.title = dashboard.title;
						} else {
							const dashboards = (await grafanaApiRequest.call(this, 'GET', '/search')) as Array<{
								title: string;
							}>;
							const titles = dashboards.map(({ title: entry }) => entry);

							if (titles.includes(title)) {
								throw new NodeApiError(this.getNode(), {
									message: 'A dashboard with the same name already exists in the selected folder',
								});
							}

							body.dashboard.title = title;
						}

						if (title) {
							body.dashboard.title = title;
						}

						if (Object.keys(rest).length) {
							if (rest.folderId === '') delete rest.folderId;
							Object.assign(body, rest);
						}

						responseData = await grafanaApiRequest.call(this, 'POST', '/dashboards/db', body);
					}
				} else if (resource === 'team') {
					// **********************************************************************
					//                                  team
					// **********************************************************************

					if (operation === 'create') {
						// ----------------------------------------
						//               team: create
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#add-team

						const body = {
							name: this.getNodeParameter('name', i) as string,
						};

						const additionalFields = this.getNodeParameter('additionalFields', i);

						if (Object.keys(additionalFields).length) {
							Object.assign(body, additionalFields);
						}

						responseData = await grafanaApiRequest.call(this, 'POST', '/teams', body);
					} else if (operation === 'delete') {
						// ----------------------------------------
						//               team: delete
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#delete-team-by-id

						const teamId = this.getNodeParameter('teamId', i);
						responseData = await grafanaApiRequest.call(this, 'DELETE', `/teams/${teamId}`);
					} else if (operation === 'get') {
						// ----------------------------------------
						//                team: get
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#get-team-by-id

						const teamId = this.getNodeParameter('teamId', i);
						responseData = await grafanaApiRequest.call(this, 'GET', `/teams/${teamId}`);
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//               team: getAll
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#team-search-with-paging

						const qs = {} as IDataObject;

						const filters = this.getNodeParameter('filters', i);

						if (Object.keys(filters).length) {
							Object.assign(qs, filters);
						}

						responseData = await grafanaApiRequest.call(this, 'GET', '/teams/search', {}, qs);
						responseData = responseData.teams;

						const returnAll = this.getNodeParameter('returnAll', i);

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i);
							responseData = responseData.slice(0, limit);
						}
					} else if (operation === 'update') {
						// ----------------------------------------
						//               team: update
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#update-team

						const updateFields = this.getNodeParameter('updateFields', i);

						throwOnEmptyUpdate.call(this, resource, updateFields);

						const body: IDataObject = {};

						const teamId = this.getNodeParameter('teamId', i);

						// check if team exists, since API does not specify update failure reason
						await grafanaApiRequest.call(this, 'GET', `/teams/${teamId}`);

						// prevent email from being overridden to empty
						if (!updateFields.email) {
							const { email } = await grafanaApiRequest.call(this, 'GET', `/teams/${teamId}`);
							body.email = email;
						}

						if (Object.keys(updateFields).length) {
							Object.assign(body, updateFields);
						}

						responseData = await grafanaApiRequest.call(this, 'PUT', `/teams/${teamId}`, body);
					}
				} else if (resource === 'teamMember') {
					// **********************************************************************
					//                               teamMember
					// **********************************************************************

					if (operation === 'add') {
						// ----------------------------------------
						//            teamMember: add
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#add-team-member

						const userId = this.getNodeParameter('userId', i) as string;

						const body = {
							userId: parseInt(userId, 10),
						};

						const teamId = this.getNodeParameter('teamId', i);
						const endpoint = `/teams/${teamId}/members`;
						responseData = await grafanaApiRequest.call(this, 'POST', endpoint, body);
					} else if (operation === 'remove') {
						// ----------------------------------------
						//            teamMember: remove
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#remove-member-from-team

						const teamId = this.getNodeParameter('teamId', i);
						const memberId = this.getNodeParameter('memberId', i);
						const endpoint = `/teams/${teamId}/members/${memberId}`;
						responseData = await grafanaApiRequest.call(this, 'DELETE', endpoint);
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//            teamMember: getAll
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/team/#get-team-members

						const teamId = this.getNodeParameter('teamId', i);

						// check if team exists, since API returns all members if team does not exist
						await grafanaApiRequest.call(this, 'GET', `/teams/${teamId}`);

						const endpoint = `/teams/${teamId}/members`;
						responseData = await grafanaApiRequest.call(this, 'GET', endpoint);

						const returnAll = this.getNodeParameter('returnAll', i);

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i);
							responseData = responseData.slice(0, limit);
						}
					}
				} else if (resource === 'user') {
					// **********************************************************************
					//                                  user
					// **********************************************************************

					if (operation === 'create') {
						// ----------------------------------------
						//                user: create
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/org/#add-a-new-user-to-the-current-organization

						const body = {
							role: this.getNodeParameter('role', i),
							loginOrEmail: this.getNodeParameter('loginOrEmail', i),
						};

						responseData = await grafanaApiRequest.call(this, 'POST', '/org/users', body);
					} else if (operation === 'delete') {
						// ----------------------------------------
						//                user: delete
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/org/#delete-user-in-current-organization

						const userId = this.getNodeParameter('userId', i);
						responseData = await grafanaApiRequest.call(this, 'DELETE', `/org/users/${userId}`);
					} else if (operation === 'getAll') {
						// ----------------------------------------
						//               user: getAll
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/org/#get-all-users-within-the-current-organization

						responseData = await grafanaApiRequest.call(this, 'GET', '/org/users');

						const returnAll = this.getNodeParameter('returnAll', i);

						if (!returnAll) {
							const limit = this.getNodeParameter('limit', i);
							responseData = responseData.slice(0, limit);
						}
					} else if (operation === 'update') {
						// ----------------------------------------
						//               user: update
						// ----------------------------------------

						// https://grafana.com/docs/grafana/latest/http_api/org/#updates-the-given-user

						const body: IDataObject = {};
						const updateFields = this.getNodeParameter('updateFields', i);

						throwOnEmptyUpdate.call(this, resource, updateFields);

						if (Object.keys(updateFields).length) {
							Object.assign(body, updateFields);
						}

						const userId = this.getNodeParameter('userId', i) as string;
						responseData = await grafanaApiRequest.call(
							this,
							'PATCH',
							`/org/users/${userId}`,
							body,
						);
					}
				} else if (resource === 'panel') {
					// **********************************************************************
					//                                panel
					// **********************************************************************

					if (operation === 'add') {
						const dashboardUid = this.getNodeParameter('dashboardUid', i) as string;

						// parse panelDefinition string thành object
						const panelDefinitionStr = this.getNodeParameter('panelDefinition', i) as string;
						const panelDefinition = JSON.parse(panelDefinitionStr);

						// 1. Get dashboard
						const { dashboard } = await grafanaApiRequest.call(
							this,
							'GET',
							`/dashboards/uid/${dashboardUid}`,
						);

						// 2. Ensure panels array
						if (!dashboard.panels) dashboard.panels = [];

						// 3. Generate new id (lớn hơn max id hiện có)
						var maxId = dashboard.panels.reduce((m: number, p: any) => Math.max(m, p.id), 0);
						(panelDefinition as any).id = maxId + 1;

						maxId = panelDefinition.id ? panelDefinition.id : maxId;

						// 4. Push new panel
						dashboard.panels.push(panelDefinition);

						// 5. Update dashboard
						const body = { dashboard, overwrite: true };
						responseData = await grafanaApiRequest.call(this, 'POST', '/dashboards/db', body);
					}
					if (operation === 'delete') {
						const dashboardUid = this.getNodeParameter('dashboardUid', i) as string;
						const panelId = this.getNodeParameter('panelId', i) as number;

						// 1. Get dashboard
						const { dashboard } = await grafanaApiRequest.call(
							this,
							'GET',
							`/dashboards/uid/${dashboardUid}`,
						);

						// 2. Ensure panels tồn tại
						if (!dashboard.panels || dashboard.panels.length === 0) {
							throw new Error(`Dashboard ${dashboardUid} does not contain any panels`);
						}

						// 3. Filter bỏ panel có id trùng panelId
						const updatedPanels = dashboard.panels.filter((p: any) => p.id !== panelId);

						if (updatedPanels.length === dashboard.panels.length) {
							throw new Error(`Panel with ID ${panelId} not found in dashboard ${dashboardUid}`);
						}

						dashboard.panels = updatedPanels;

						// 4. Update dashboard
						const body = { dashboard, overwrite: true };
						responseData = await grafanaApiRequest.call(this, 'POST', '/dashboards/db', body);
					}
				}
				Array.isArray(responseData)
					? returnData.push(...(responseData as IDataObject[]))
					: returnData.push(responseData as IDataObject);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
