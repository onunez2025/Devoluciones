import axios from 'axios';

const API_URL = '/api/managements';

export interface Management {
  Id: string;
  Name: string;
  Code: string;
}

export const managementsService = {
  getManagements: async () => {
    const response = await axios.get<Management[]>(API_URL);
    return response.data;
  }
};
