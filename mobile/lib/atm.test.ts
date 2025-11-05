import { searchNearbyATMs, geocodeAddress } from '@/lib/atm';

// Mock fetch globally
global.fetch = jest.fn();

describe('lib/atm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  describe('searchNearbyATMs', () => {
    it('should throw error if API key is not configured', async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        'Google Maps API key not configured'
      );
    });

    it('should successfully search for nearby ATMs', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            place_id: '1',
            name: 'Chase ATM',
            vicinity: '123 Main St',
            geometry: {
              location: {
                lat: 37.775,
                lng: -122.42,
              },
            },
            rating: 4.5,
            user_ratings_total: 10,
          },
          {
            place_id: '2',
            name: 'Chase ATM',
            vicinity: '456 Oak Ave',
            geometry: {
              location: {
                lat: 37.776,
                lng: -122.421,
              },
            },
            rating: 4.0,
            user_ratings_total: 5,
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      expect(result).toHaveLength(2);
      expect(result[0].place_id).toBe('1');
      expect(result[0].distance).toBeDefined();
      expect(result[0].distance).toBeLessThan(result[1].distance!);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maps.googleapis.com/maps/api/place/nearbysearch/json')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('location=37.7749,-122.4194')
      );
    });

    it('should handle ZERO_RESULTS status', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
        results: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      expect(result).toHaveLength(0);
    });

    it('should throw error on API error status', async () => {
      const mockResponse = {
        status: 'REQUEST_DENIED',
        results: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        'Failed to search for nearby ATMs'
      );
    });

    it('should throw error on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(searchNearbyATMs(37.7749, -122.4194)).rejects.toThrow(
        'Failed to search for nearby ATMs'
      );
    });

    it('should sort results by distance', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            place_id: 'far',
            name: 'Far ATM',
            vicinity: 'Far Street',
            geometry: {
              location: {
                lat: 37.8,
                lng: -122.5,
              },
            },
          },
          {
            place_id: 'near',
            name: 'Near ATM',
            vicinity: 'Near Street',
            geometry: {
              location: {
                lat: 37.775,
                lng: -122.42,
              },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchNearbyATMs(37.7749, -122.4194);

      expect(result[0].place_id).toBe('near');
      expect(result[1].place_id).toBe('far');
      expect(result[0].distance!).toBeLessThan(result[1].distance!);
    });
  });

  describe('geocodeAddress', () => {
    it('should throw error if API key is not configured', async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      await expect(geocodeAddress('123 Main St')).rejects.toThrow(
        'Google Maps API key not configured'
      );
    });

    it('should successfully geocode an address', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: {
                lat: 37.7749,
                lng: -122.4194,
              },
            },
            formatted_address: '123 Main St, San Francisco, CA 94102, USA',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('123 Main St');

      expect(result.lat).toBe(37.7749);
      expect(result.lng).toBe(-122.4194);
      expect(result.formatted_address).toBe('123 Main St, San Francisco, CA 94102, USA');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maps.googleapis.com/maps/api/geocode/json')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('address=123%20Main%20St')
      );
    });

    it('should throw error on no results', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
        results: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(geocodeAddress('Invalid Address')).rejects.toThrow(
        'Failed to geocode address'
      );
    });

    it('should throw error on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(geocodeAddress('123 Main St')).rejects.toThrow(
        'Failed to geocode address'
      );
    });
  });
});

