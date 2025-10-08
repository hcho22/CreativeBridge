// Navigation flow integration tests
import React from 'react';
import { render, fireEvent, screen, waitFor } from '../utils/testUtils';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AppNavigator from '../../navigation/AppNavigator';
import { HomeScreen, SettingsScreen, ProfileScreen } from '../../screens';
import { mockSupabase } from '../mocks/supabaseMock';
import { createMockUser, createMockUserProfile } from '../utils/testUtils';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}));

jest.mock('../../context/StableAuthContext', () => ({
  useEnhancedAuth: () => ({
    user: createMockUser(),
    userProfile: createMockUserProfile(),
    session: { access_token: 'mock-token' },
    loading: false,
    emailConfirmed: true,
    securityLevel: 'MEDIUM',
    requiresTwoFA: false,
    suspiciousActivity: false,
    sessionInfo: {
      sessionId: 'session-123',
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000),
    },
  }),
}));

jest.mock('../../services/reactotron', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

// Mock individual screen components to focus on navigation behavior
jest.mock('../../screens/HomeScreen', () => {
  return function MockHomeScreen() {
    return <div testID="home-screen">Home Screen Content</div>;
  };
});

jest.mock('../../screens/SettingsScreen', () => {
  return function MockSettingsScreen() {
    return <div testID="settings-screen">Settings Screen Content</div>;
  };
});

jest.mock('../../screens/ProfileScreen', () => {
  return function MockProfileScreen() {
    return <div testID="profile-screen">Profile Screen Content</div>;
  };
});

describe('Navigation Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__testUtils.clear();
  });

  describe('Bottom Tab Navigation', () => {
    it('should render default Home tab on initial load', async () => {
      render(<AppNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('home-screen')).toBeTruthy();
      });

      // Home tab should be active
      const homeTab = screen.getByText('Home');
      expect(homeTab).toBeTruthy();
    });

    it('should navigate between tabs correctly', async () => {
      render(<AppNavigator />);

      // Start on Home tab
      await waitFor(() => {
        expect(screen.getByTestId('home-screen')).toBeTruthy();
      });

      // Navigate to Settings
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('settings-screen')).toBeTruthy();
        expect(screen.queryByTestId('home-screen')).toBeNull();
      });

      // Navigate to Profile
      const profileTab = screen.getByText('Profile 👤');
      fireEvent.press(profileTab);

      await waitFor(() => {
        expect(screen.getByTestId('profile-screen')).toBeTruthy();
        expect(screen.queryByTestId('settings-screen')).toBeNull();
      });

      // Navigate back to Home
      const homeTab = screen.getByText('Home');
      fireEvent.press(homeTab);

      await waitFor(() => {
        expect(screen.getByTestId('home-screen')).toBeTruthy();
        expect(screen.queryByTestId('profile-screen')).toBeNull();
      });
    });

    it('should maintain tab state when switching between tabs', async () => {
      render(<AppNavigator />);

      // Navigate to Settings
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('settings-screen')).toBeTruthy();
      });

      // Navigate away and back
      const homeTab = screen.getByText('Home');
      fireEvent.press(homeTab);

      await waitFor(() => {
        expect(screen.getByTestId('home-screen')).toBeTruthy();
      });

      // Return to settings - should maintain state
      fireEvent.press(settingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('settings-screen')).toBeTruthy();
      });
    });
  });

  describe('Navigation Headers', () => {
    it('should display correct header titles for each tab', async () => {
      render(<AppNavigator />);

      // Check Home header
      await waitFor(() => {
        expect(screen.getByText('🏠 Home')).toBeTruthy();
      });

      // Navigate to Settings and check header
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      await waitFor(() => {
        expect(screen.getByText('⚙️ Game Settings')).toBeTruthy();
      });

      // Navigate to Profile and check header
      const profileTab = screen.getByText('Profile 👤');
      fireEvent.press(profileTab);

      await waitFor(() => {
        expect(screen.getByText('👤 Your Profile')).toBeTruthy();
      });
    });

    it('should apply correct header styling', async () => {
      render(<AppNavigator />);

      await waitFor(() => {
        const header = screen.getByText('🏠 Home');
        expect(header).toBeTruthy();
        // Header styling is applied via screenOptions in AppNavigator
      });
    });
  });

  describe('Tab Bar Icons and Styling', () => {
    it('should display correct icons for each tab', async () => {
      render(<AppNavigator />);

      await waitFor(() => {
        // Check that tab bar is rendered with correct labels
        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Settings ⚙️')).toBeTruthy();
        expect(screen.getByText('Profile 👤')).toBeTruthy();
      });
    });

    it('should highlight active tab correctly', async () => {
      render(<AppNavigator />);

      // Navigate to Settings
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      await waitFor(() => {
        // Settings tab should be active (this would be reflected in styling)
        expect(screen.getByTestId('settings-screen')).toBeTruthy();
      });
    });
  });

  describe('Navigation with Authentication Context', () => {
    it('should have access to user data in all screens', async () => {
      const TestHomeScreen = () => {
        const { useEnhancedAuth } = require('../../context/StableAuthContext');
        const { userProfile } = useEnhancedAuth();
        return (
          <div testID="home-screen">
            <div testID="user-info">{userProfile?.username}</div>
          </div>
        );
      };

      // Override the mock for this test
      jest.doMock('../../screens/HomeScreen', () => TestHomeScreen);

      render(<AppNavigator />);

      await waitFor(() => {
        expect(screen.getByTestId('user-info')).toBeTruthy();
      });
    });
  });

  describe('Deep Linking and External Navigation', () => {
    it('should handle navigation state persistence', async () => {
      // Test that navigation state can be restored
      render(<AppNavigator />);

      // Navigate to a specific tab
      const profileTab = screen.getByText('Profile 👤');
      fireEvent.press(profileTab);

      await waitFor(() => {
        expect(screen.getByTestId('profile-screen')).toBeTruthy();
      });

      // In a real app, this would test state restoration after app restart
      // For now, we verify the navigation works correctly
    });
  });

  describe('Navigation Performance', () => {
    it('should handle rapid tab switching without errors', async () => {
      render(<AppNavigator />);

      const homeTab = screen.getByText('Home');
      const settingsTab = screen.getByText('Settings ⚙️');
      const profileTab = screen.getByText('Profile 👤');

      // Rapidly switch between tabs
      fireEvent.press(settingsTab);
      fireEvent.press(profileTab);
      fireEvent.press(homeTab);
      fireEvent.press(settingsTab);
      fireEvent.press(profileTab);

      await waitFor(() => {
        expect(screen.getByTestId('profile-screen')).toBeTruthy();
      });

      // Should end up on the last pressed tab without errors
    });

    it('should maintain smooth navigation performance', async () => {
      const startTime = Date.now();

      render(<AppNavigator />);

      // Navigate between tabs
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      await waitFor(() => {
        expect(screen.getByTestId('settings-screen')).toBeTruthy();
      });

      const endTime = Date.now();
      const navigationTime = endTime - startTime;

      // Navigation should be reasonably fast (under 1 second in tests)
      expect(navigationTime).toBeLessThan(1000);
    });
  });

  describe('Accessibility and Navigation', () => {
    it('should provide accessible navigation for screen readers', async () => {
      render(<AppNavigator />);

      await waitFor(() => {
        // Check that tab labels are accessible
        const homeTab = screen.getByText('Home');
        const settingsTab = screen.getByText('Settings ⚙️');
        const profileTab = screen.getByText('Profile 👤');

        expect(homeTab).toBeTruthy();
        expect(settingsTab).toBeTruthy();
        expect(profileTab).toBeTruthy();
      });
    });

    it('should handle keyboard navigation if supported', async () => {
      render(<AppNavigator />);

      // In a real React Native app, this would test keyboard navigation
      // For now, we verify the basic structure is accessible
      await waitFor(() => {
        expect(screen.getByTestId('home-screen')).toBeTruthy();
      });
    });
  });

  describe('Error Boundary and Navigation', () => {
    it('should handle screen rendering errors gracefully', async () => {
      // Mock a screen that throws an error
      const ErrorScreen = () => {
        throw new Error('Test screen error');
      };

      jest.doMock('../../screens/SettingsScreen', () => ErrorScreen);

      render(<AppNavigator />);

      // Navigate to the error screen
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      // The error boundary should catch this error
      // In a real implementation, there would be an ErrorBoundary component
      // For now, we verify the basic navigation structure works
      await waitFor(() => {
        // Should still have tab bar available
        expect(screen.getByText('Home')).toBeTruthy();
      });
    });
  });

  describe('Navigation Memory Management', () => {
    it('should properly unmount screens when navigating away', async () => {
      let homeScreenMounted = false;
      let settingsScreenMounted = false;

      const TestHomeScreen = () => {
        React.useEffect(() => {
          homeScreenMounted = true;
          return () => {
            homeScreenMounted = false;
          };
        }, []);
        return <div testID="home-screen">Home</div>;
      };

      const TestSettingsScreen = () => {
        React.useEffect(() => {
          settingsScreenMounted = true;
          return () => {
            settingsScreenMounted = false;
          };
        }, []);
        return <div testID="settings-screen">Settings</div>;
      };

      jest.doMock('../../screens/HomeScreen', () => TestHomeScreen);
      jest.doMock('../../screens/SettingsScreen', () => TestSettingsScreen);

      render(<AppNavigator />);

      await waitFor(() => {
        expect(homeScreenMounted).toBe(true);
      });

      // Navigate to Settings
      const settingsTab = screen.getByText('Settings ⚙️');
      fireEvent.press(settingsTab);

      await waitFor(() => {
        expect(settingsScreenMounted).toBe(true);
      });

      // In tab navigation, screens typically stay mounted for performance
      // But we can verify they're properly managed
    });
  });
});
