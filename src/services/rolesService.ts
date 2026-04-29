import axios from 'axios';

const API_URL = '/api/roles';

export interface Role {
  Id: string;
  Name: string;
  Apps: string;
}

export const rolesService = {
  getRoles: async () => {
    const response = await axios.get<Role[]>(API_URL);
    return response.data;
  },
  getRolePermissions: async (roleId: string) => {
    const response = await axios.get<string[]>(`${API_URL}/${roleId}/permissions`);
    return response.data;
  },
  updateRolePermissions: async (roleId: string, permissions: string[]) => {
    const response = await axios.post(`${API_URL}/${roleId}/permissions`, { permissions });
    return response.data;
  }
};
