import axios from 'axios';

const API_URL = '/api/users';

export interface User {
  Id: string;
  Username: string;
  Email: string;
  FullName: string;
  RoleId: string;
  RoleName?: string;
  ManagementId: string;
  ManagementName?: string;
  IsActive: boolean;
  Apps: string;
}

export const usersService = {
  getUsers: async () => {
    const response = await axios.get<User[]>(API_URL);
    return response.data;
  },
  createUser: async (user: any) => {
    const response = await axios.post(API_URL, user);
    return response.data;
  },
  updateUser: async (id: string, user: any) => {
    const response = await axios.put(`${API_URL}/${id}`, user);
    return response.data;
  }
};
