import type { IDataObject } from 'n8n-workflow';

export type GrafanaCredentials = {
	apiKey: string;
	baseUrl: string;
};

export type DashboardUpdatePayload = {
	overwrite: true;
	dashboard: {
		uid: string;
		title?: string;
	};
};

export type DashboardUpdateFields = {
	title?: string;
	folderId?: string;
};

export type LoadedDashboards = Array<{
	id: number;
	title: string;
}>;

export type LoadedFolders = LoadedDashboards;

export type LoadedTeams = {
	teams: Array<{
		id: number;
		name: string;
	}>;
};

export type LoadedUsers = Array<{
	userId: number;
	email: string;
}>;

export interface PanelDefinition {
	id?: number; // sẽ được generate khi thêm panel
	title: string;
	type: string; // ví dụ: graph, table, stat, text...
	gridPos?: {
		h: number; // height
		w: number; // width
		x: number; // position x
		y: number; // position y
	};
	datasource?: string | null;
	targets?: Array<IDataObject>; // query targets (Prometheus, Loki, etc.)
	options?: IDataObject; // các option khác
	fieldConfig?: IDataObject;
	[key: string]: any; // fallback cho trường khác Grafana cho phép
}
