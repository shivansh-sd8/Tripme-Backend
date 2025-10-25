import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  AuthResponse, 
  Listing, 
  Booking, 
  Review, 
  Payment, 
  Service, 
  SupportTicket, 
  Notification, 
  Wishlist,
  ApiResponse,
  PaginatedResponse,
  LoginForm,
  RegisterForm,
  ListingForm,
  BookingForm,
  ReviewForm,
  SearchFilters
} from '../types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://localhost:5001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: RegisterForm): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/register', data),
  
  login: (data: LoginForm): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/login', data),
  
  logout: (): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.post('/auth/logout'),
  
  getMe: (): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.get('/auth/me'),
  
  updateProfile: (data: Partial<User>): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.put('/auth/profile', data),
  
  forgotPassword: (email: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.post(`/auth/reset-password/${token}`, { password }),
  
  verifyEmail: (token: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.post(`/auth/verify-email/${token}`),
};

// User API
export const userAPI = {
  getProfile: (): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.get('/users/profile'),
  
  updateProfile: (data: Partial<User>): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.put('/users/profile', data),
  
  submitKYC: (data: any): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.post('/users/kyc', data),
  
  getDashboard: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/users/dashboard'),
  
  getStats: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/users/stats'),
};

// Listing API
export const listingAPI = {
  getAll: (params?: SearchFilters): Promise<AxiosResponse<PaginatedResponse<Listing>>> =>
    api.get('/listings', { params }),
  
  search: (params: SearchFilters): Promise<AxiosResponse<PaginatedResponse<Listing>>> =>
    api.get('/listings/search', { params }),
  
  getById: (id: string): Promise<AxiosResponse<ApiResponse<Listing>>> =>
    api.get(`/listings/${id}`),
  
  create: (data: ListingForm): Promise<AxiosResponse<ApiResponse<Listing>>> =>
    api.post('/listings', data),
  
  update: (id: string, data: Partial<ListingForm>): Promise<AxiosResponse<ApiResponse<Listing>>> =>
    api.put(`/listings/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.delete(`/listings/${id}`),
  
  getMyListings: (): Promise<AxiosResponse<ApiResponse<Listing[]>>> =>
    api.get('/listings/my'),
  
  getFeatured: (): Promise<AxiosResponse<ApiResponse<Listing[]>>> =>
    api.get('/listings/featured'),
  
  getSimilar: (id: string): Promise<AxiosResponse<ApiResponse<Listing[]>>> =>
    api.get(`/listings/${id}/similar`),
  
  addToWishlist: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.post(`/listings/${id}/wishlist`),
  
  removeFromWishlist: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.delete(`/listings/${id}/wishlist`),
};

// Booking API
export const bookingAPI = {
  create: (data: BookingForm): Promise<AxiosResponse<ApiResponse<Booking>>> =>
    api.post('/bookings', data),
  
  getAll: (): Promise<AxiosResponse<ApiResponse<Booking[]>>> =>
    api.get('/bookings'),
  
  getById: (id: string): Promise<AxiosResponse<ApiResponse<Booking>>> =>
    api.get(`/bookings/${id}`),
  
  update: (id: string, data: Partial<Booking>): Promise<AxiosResponse<ApiResponse<Booking>>> =>
    api.put(`/bookings/${id}`, data),
  
  cancel: (id: string): Promise<AxiosResponse<ApiResponse<Booking>>> =>
    api.delete(`/bookings/${id}`),
  
  getMyBookings: (): Promise<AxiosResponse<ApiResponse<Booking[]>>> =>
    api.get('/bookings/my'),
  
  getHostBookings: (): Promise<AxiosResponse<ApiResponse<Booking[]>>> =>
    api.get('/bookings/host'),
  
  calculatePrice: (data: BookingForm): Promise<AxiosResponse<ApiResponse<{ totalAmount: number }>>> =>
    api.post('/bookings/calculate-price', data),
};

// Payment API
export const paymentAPI = {
  process: (data: any): Promise<AxiosResponse<ApiResponse<Payment>>> =>
    api.post('/payments/process', data),
  
  getAll: (): Promise<AxiosResponse<ApiResponse<Payment[]>>> =>
    api.get('/payments'),
  
  getById: (id: string): Promise<AxiosResponse<ApiResponse<Payment>>> =>
    api.get(`/payments/${id}`),
  
  refund: (paymentId: string, data: any): Promise<AxiosResponse<ApiResponse<Payment>>> =>
    api.post(`/payments/${paymentId}/refund`, data),
};

// Review API
export const reviewAPI = {
  create: (data: ReviewForm): Promise<AxiosResponse<ApiResponse<Review>>> =>
    api.post('/reviews', data),
  
  getAll: (): Promise<AxiosResponse<ApiResponse<Review[]>>> =>
    api.get('/reviews'),
  
  getById: (id: string): Promise<AxiosResponse<ApiResponse<Review>>> =>
    api.get(`/reviews/${id}`),
  
  update: (id: string, data: Partial<ReviewForm>): Promise<AxiosResponse<ApiResponse<Review>>> =>
    api.put(`/reviews/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.delete(`/reviews/${id}`),
  
  getPropertyReviews: (propertyId: string): Promise<AxiosResponse<ApiResponse<Review[]>>> =>
    api.get(`/reviews/properties/${propertyId}`),
  
  getServiceReviews: (serviceId: string): Promise<AxiosResponse<ApiResponse<Review[]>>> =>
    api.get(`/reviews/services/${serviceId}`),
  
  getMyReviews: (): Promise<AxiosResponse<ApiResponse<Review[]>>> =>
    api.get('/reviews/my'),
  
  getReceivedReviews: (): Promise<AxiosResponse<ApiResponse<Review[]>>> =>
    api.get('/reviews/received'),
};

// Service API
export const serviceAPI = {
  getAll: (): Promise<AxiosResponse<ApiResponse<Service[]>>> =>
    api.get('/services'),
  
  getById: (id: string): Promise<AxiosResponse<ApiResponse<Service>>> =>
    api.get(`/services/${id}`),
  
  create: (data: any): Promise<AxiosResponse<ApiResponse<Service>>> =>
    api.post('/services', data),
  
  update: (id: string, data: any): Promise<AxiosResponse<ApiResponse<Service>>> =>
    api.put(`/services/${id}`, data),
  
  delete: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.delete(`/services/${id}`),
  
  getMyServices: (): Promise<AxiosResponse<ApiResponse<Service[]>>> =>
    api.get('/services/my'),
  
  getFeatured: (): Promise<AxiosResponse<ApiResponse<Service[]>>> =>
    api.get('/services/featured'),
};

// Support API
export const supportAPI = {
  createTicket: (data: any): Promise<AxiosResponse<ApiResponse<SupportTicket>>> =>
    api.post('/support/tickets', data),
  
  getAllTickets: (): Promise<AxiosResponse<ApiResponse<SupportTicket[]>>> =>
    api.get('/support/tickets'),
  
  getTicketById: (id: string): Promise<AxiosResponse<ApiResponse<SupportTicket>>> =>
    api.get(`/support/tickets/${id}`),
  
  updateTicket: (id: string, data: any): Promise<AxiosResponse<ApiResponse<SupportTicket>>> =>
    api.put(`/support/tickets/${id}`, data),
  
  addMessage: (ticketId: string, data: { message: string }): Promise<AxiosResponse<ApiResponse<SupportTicket>>> =>
    api.post(`/support/tickets/${ticketId}/messages`, data),
};

// Notification API
export const notificationAPI = {
  getAll: (): Promise<AxiosResponse<ApiResponse<Notification[]>>> =>
    api.get('/notifications'),
  
  markAsRead: (id: string): Promise<AxiosResponse<ApiResponse<Notification>>> =>
    api.patch(`/notifications/${id}/read`),
  
  delete: (id: string): Promise<AxiosResponse<ApiResponse<null>>> =>
    api.delete(`/notifications/${id}`),
};

// Wishlist API
export const wishlistAPI = {
  getAll: (): Promise<AxiosResponse<ApiResponse<Wishlist[]>>> =>
    api.get('/wishlist'),
  
  create: (data: { name: string; isPublic: boolean }): Promise<AxiosResponse<ApiResponse<Wishlist>>> =>
    api.post('/wishlist', data),
  
  addItem: (wishlistId: string, data: { type: 'listing' | 'service'; itemId: string }): Promise<AxiosResponse<ApiResponse<Wishlist>>> =>
    api.post(`/wishlist/${wishlistId}/items`, data),
  
  removeItem: (wishlistId: string, itemId: string): Promise<AxiosResponse<ApiResponse<Wishlist>>> =>
    api.delete(`/wishlist/${wishlistId}/items/${itemId}`),
};

export default api; 