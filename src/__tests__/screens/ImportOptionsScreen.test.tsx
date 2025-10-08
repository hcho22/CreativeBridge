// Jest Tests for Task 6: Create Import Options Screen

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ImportOptionsScreen } from '../../screens/ImportOptionsScreen';

// Mock useNavigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('ImportOptionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render import options screen correctly', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      expect(getByText('Continue Your Story')).toBeTruthy();
      expect(getByText('Choose how to continue')).toBeTruthy();
      expect(getByText('Import from File')).toBeTruthy();
      expect(getByText('My Stories')).toBeTruthy();
    });

    it('should render header with back button', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      expect(getByText('←')).toBeTruthy();
      expect(getByText('Continue Your Story')).toBeTruthy();
    });

    it('should render option descriptions', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      expect(
        getByText(
          "Choose a .txt file from your device to continue writing. Perfect for stories you've written elsewhere.",
        ),
      ).toBeTruthy();
      expect(
        getByText(
          'Continue from your previously created stories in CreativeBridge or Story_Quest.',
        ),
      ).toBeTruthy();
    });

    it('should render feature lists for each option', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      // File import features
      expect(getByText('• Upload .txt files')).toBeTruthy();
      expect(getByText('• Maintains original formatting')).toBeTruthy();
      expect(getByText('• Quick and easy import')).toBeTruthy();

      // Story library features
      expect(getByText('• Access your story library')).toBeTruthy();
      expect(getByText('• Search and filter stories')).toBeTruthy();
      expect(getByText('• Pick up where you left off')).toBeTruthy();
    });

    it('should render help section', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      expect(getByText('Need Help?')).toBeTruthy();
      expect(getByText(/Not sure which option to choose/)).toBeTruthy();
    });

    it('should render icons and arrows', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      expect(getByText('📄')).toBeTruthy(); // File icon
      expect(getByText('📚')).toBeTruthy(); // Library icon

      const arrows = getByText('→');
      expect(arrows).toBeTruthy();
    });
  });

  describe('Navigation Handling', () => {
    it('should navigate to FilePicker when Import from File is pressed', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      const fileImportButton = getByText('Import from File');
      fireEvent.press(fileImportButton);

      expect(mockNavigate).toHaveBeenCalledWith('FilePicker');
    });

    it('should navigate to StorySelection when My Stories is pressed', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      const storyLibraryButton = getByText('My Stories');
      fireEvent.press(storyLibraryButton);

      expect(mockNavigate).toHaveBeenCalledWith('StorySelection');
    });

    it('should go back when back button is pressed', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      const backButton = getByText('←');
      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('should navigate to Home when back is not available', () => {
      mockCanGoBack.mockReturnValueOnce(false);

      const { getByText } = render(<ImportOptionsScreen />);

      const backButton = getByText('←');
      fireEvent.press(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  describe('Custom Prop Handlers', () => {
    it('should call custom onFileImport handler when provided', () => {
      const mockOnFileImport = jest.fn();
      const { getByText } = render(
        <ImportOptionsScreen onFileImport={mockOnFileImport} />,
      );

      const fileImportButton = getByText('Import from File');
      fireEvent.press(fileImportButton);

      expect(mockOnFileImport).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should call custom onStoryLibraryImport handler when provided', () => {
      const mockOnStoryLibraryImport = jest.fn();
      const { getByText } = render(
        <ImportOptionsScreen onStoryLibraryImport={mockOnStoryLibraryImport} />,
      );

      const storyLibraryButton = getByText('My Stories');
      fireEvent.press(storyLibraryButton);

      expect(mockOnStoryLibraryImport).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should call custom onBack handler when provided', () => {
      const mockOnBack = jest.fn();
      const { getByText } = render(<ImportOptionsScreen onBack={mockOnBack} />);

      const backButton = getByText('←');
      fireEvent.press(backButton);

      expect(mockOnBack).toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show alert when navigation to FilePicker fails', () => {
      mockNavigate.mockImplementationOnce(() => {
        throw new Error('Navigation error');
      });

      const { getByText } = render(<ImportOptionsScreen />);

      const fileImportButton = getByText('Import from File');
      fireEvent.press(fileImportButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Coming Soon',
        'File import functionality is being developed. This will allow you to import .txt files from your device.',
      );
    });

    it('should show alert when navigation to StorySelection fails', () => {
      mockNavigate.mockImplementationOnce(() => {
        throw new Error('Navigation error');
      });

      const { getByText } = render(<ImportOptionsScreen />);

      const storyLibraryButton = getByText('My Stories');
      fireEvent.press(storyLibraryButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Coming Soon',
        'Story library import is being developed. This will allow you to continue your previously created stories.',
      );
    });

    it('should handle back navigation errors gracefully', () => {
      mockGoBack.mockImplementationOnce(() => {
        throw new Error('Navigation error');
      });
      mockCanGoBack.mockReturnValueOnce(true);

      const { getByText } = render(<ImportOptionsScreen />);

      const backButton = getByText('←');

      // Should not throw error
      expect(() => fireEvent.press(backButton)).not.toThrow();
    });
  });

  describe('Accessibility and UX', () => {
    it('should have touchable option cards', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      const fileImportCard = getByText('Import from File').parent?.parent;
      const storyLibraryCard = getByText('My Stories').parent?.parent;

      expect(fileImportCard).toBeTruthy();
      expect(storyLibraryCard).toBeTruthy();
    });

    it('should have proper visual feedback on press', async () => {
      const { getByText } = render(<ImportOptionsScreen />);

      const fileImportButton = getByText('Import from File');

      // Test that press event is handled (basic interaction test)
      fireEvent.press(fileImportButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });

    it('should display clear visual hierarchy', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      // Main title should be present
      expect(getByText('Continue Your Story')).toBeTruthy();

      // Section title should be present
      expect(getByText('Choose how to continue')).toBeTruthy();

      // Option titles should be present
      expect(getByText('Import from File')).toBeTruthy();
      expect(getByText('My Stories')).toBeTruthy();

      // Help section should be present
      expect(getByText('Need Help?')).toBeTruthy();
    });

    it('should have consistent spacing and layout', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      // All main elements should render without layout errors
      expect(getByText('Continue Your Story')).toBeTruthy();
      expect(getByText('Import from File')).toBeTruthy();
      expect(getByText('My Stories')).toBeTruthy();
      expect(getByText('Need Help?')).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    it('should render properly with different screen sizes', () => {
      // Mock different screen dimensions
      const originalGet = require('react-native').Dimensions.get;

      // Test with smaller screen
      require('react-native').Dimensions.get = jest.fn().mockReturnValue({
        width: 320,
        height: 568,
      });

      const { getByText: getByTextSmall } = render(<ImportOptionsScreen />);
      expect(getByTextSmall('Continue Your Story')).toBeTruthy();

      // Test with larger screen
      require('react-native').Dimensions.get = jest.fn().mockReturnValue({
        width: 414,
        height: 896,
      });

      const { getByText: getByTextLarge } = render(<ImportOptionsScreen />);
      expect(getByTextLarge('Continue Your Story')).toBeTruthy();

      // Restore original
      require('react-native').Dimensions.get = originalGet;
    });

    it('should handle content overflow gracefully', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      // Long descriptions should render without breaking layout
      expect(getByText(/Choose a .txt file from your device/)).toBeTruthy();
      expect(
        getByText(/Continue from your previously created stories/),
      ).toBeTruthy();
    });
  });

  describe('Integration with Navigation Prop', () => {
    it('should work with custom navigation prop', () => {
      const customNavigation = {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn().mockReturnValue(true),
      };

      const { getByText } = render(
        <ImportOptionsScreen navigation={customNavigation as any} />,
      );

      const fileImportButton = getByText('Import from File');
      fireEvent.press(fileImportButton);

      expect(customNavigation.navigate).toHaveBeenCalledWith('FilePicker');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should prioritize custom navigation over useNavigation hook', () => {
      const customNavigation = {
        navigate: jest.fn(),
        goBack: jest.fn(),
        canGoBack: jest.fn().mockReturnValue(true),
      };

      const { getByText } = render(
        <ImportOptionsScreen navigation={customNavigation as any} />,
      );

      const backButton = getByText('←');
      fireEvent.press(backButton);

      expect(customNavigation.goBack).toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe('Content Validation', () => {
    it('should have informative descriptions', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      // Check that descriptions explain the functionality
      expect(
        getByText(/Choose a .txt file from your device to continue writing/),
      ).toBeTruthy();
      expect(
        getByText(/Continue from your previously created stories/),
      ).toBeTruthy();
      expect(
        getByText(/Select an option below to import a story/),
      ).toBeTruthy();
    });

    it('should list specific features for each option', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      // File import features
      expect(getByText('• Upload .txt files')).toBeTruthy();
      expect(getByText('• Maintains original formatting')).toBeTruthy();
      expect(getByText('• Quick and easy import')).toBeTruthy();

      // Library features
      expect(getByText('• Access your story library')).toBeTruthy();
      expect(getByText('• Search and filter stories')).toBeTruthy();
      expect(getByText('• Pick up where you left off')).toBeTruthy();
    });

    it('should provide helpful guidance in help section', () => {
      const { getByText } = render(<ImportOptionsScreen />);

      expect(getByText(/Not sure which option to choose/)).toBeTruthy();
      expect(
        getByText(
          /Use "Import from File" if you have a story saved as a text file/,
        ),
      ).toBeTruthy();
    });
  });
});
