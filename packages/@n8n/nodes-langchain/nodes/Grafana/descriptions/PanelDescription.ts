import type { INodeProperties } from 'n8n-workflow';

export const panelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add a new panel to a dashboard',
				action: 'Add a panel',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a panel from a dashboard',
				action: 'Delete a panel',
			},
		],
		default: 'add',
		displayOptions: { show: { resource: ['panel'] } },
	},
];

export const panelFields: INodeProperties[] = [
	{
		displayName: 'Dashboard UID',
		name: 'dashboardUid',
		type: 'string',
		required: true,
		default: '',
		description: 'UID of the dashboard where the panel will be added or deleted',
		displayOptions: { show: { resource: ['panel'], operation: ['add', 'delete'] } },
	},
	{
		displayName: 'Panel Definition (JSON)',
		name: 'panelDefinition',
		type: 'string', // sửa từ json -> string để có thể gõ JSON hoặc text
		required: true,
		default: '',
		description: `JSON object describing the panel to add. Example:
{
  "type": "graph",
  "title": "CPU Usage",
  "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
  "targets": [
    { "expr": "node_cpu_seconds_total", "refId": "A" }
  ]
}

AI agent should provide a valid JSON object as string.`,
		typeOptions: { rows: 10 },
		displayOptions: { show: { resource: ['panel'], operation: ['add'] } },
	},
	{
		displayName: 'Panel ID',
		name: 'panelId',
		type: 'number',
		required: true,
		default: 1,
		description: 'ID of the panel to delete',
		displayOptions: { show: { resource: ['panel'], operation: ['delete'] } },
	},
];
