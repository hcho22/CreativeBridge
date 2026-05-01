/**
 * Download Keyboard Navigation Service (Task 2.6.5)
 * Provides keyboard navigation support for download components
 */

import { Platform } from 'react-native';

export interface KeyboardNavigationConfig {
  enableTabNavigation: boolean;
  enableArrowKeyNavigation: boolean;
  enableEnterKeyActivation: boolean;
  enableEscapeKeyDismissal: boolean;
  enableSpaceKeyActivation: boolean;
  focusRingVisible: boolean;
}

export interface FocusableElement {
  id: string;
  ref: any;
  order: number;
  enabled: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onActivate?: () => void;
}

export interface KeyboardEventHandler {
  key: string;
  handler: (event: any) => boolean; // Return true if handled
  description: string;
}

export class DownloadKeyboardNavigationService {
  private config: KeyboardNavigationConfig = {
    enableTabNavigation: true,
    enableArrowKeyNavigation: true,
    enableEnterKeyActivation: true,
    enableEscapeKeyDismissal: true,
    enableSpaceKeyActivation: true,
    focusRingVisible: Platform.OS === 'web',
  };

  private focusableElements: Map<string, FocusableElement> = new Map();
  private currentFocusIndex: number = -1;
  private isActive: boolean = false;
  private keyboardHandlers: Map<string, KeyboardEventHandler> = new Map();

  /**
   * Initialize keyboard navigation service
   */
  initialize(): void {
    if (Platform.OS === 'web') {
      this.setupWebKeyboardHandlers();
    } else {
      this.setupNativeKeyboardHandlers();
    }

    this.isActive = true;
    console.log('⌨️ Keyboard navigation service initialized');
  }

  /**
   * Cleanup keyboard navigation service
   */
  cleanup(): void {
    this.focusableElements.clear();
    this.keyboardHandlers.clear();
    this.isActive = false;

    if (Platform.OS === 'web') {
      (globalThis as { document?: EventTarget }).document?.removeEventListener(
        'keydown',
        this.handleWebKeyDown,
      );
    }

    console.log('⌨️ Keyboard navigation service cleaned up');
  }

  /**
   * Register a focusable element for keyboard navigation
   */
  registerElement(element: FocusableElement): void {
    this.focusableElements.set(element.id, element);
    this.sortElementsByOrder();
    console.log(`⌨️ Registered focusable element: ${element.id}`);
  }

  /**
   * Unregister a focusable element
   */
  unregisterElement(elementId: string): void {
    this.focusableElements.delete(elementId);
    this.sortElementsByOrder();
    console.log(`⌨️ Unregistered focusable element: ${elementId}`);
  }

  /**
   * Set focus to specific element
   */
  focusElement(elementId: string): boolean {
    const element = this.focusableElements.get(elementId);
    if (!element || !element.enabled) {
      return false;
    }

    const elements = this.getSortedElements();
    const index = elements.findIndex(el => el.id === elementId);

    if (index >= 0) {
      this.setFocus(index);
      return true;
    }

    return false;
  }

  /**
   * Move focus to next element
   */
  focusNext(): boolean {
    if (!this.config.enableTabNavigation) return false;

    const elements = this.getSortedElements();
    if (elements.length === 0) return false;

    let nextIndex = this.currentFocusIndex + 1;
    if (nextIndex >= elements.length) {
      nextIndex = 0; // Wrap to first element
    }

    return this.setFocus(nextIndex);
  }

  /**
   * Move focus to previous element
   */
  focusPrevious(): boolean {
    if (!this.config.enableTabNavigation) return false;

    const elements = this.getSortedElements();
    if (elements.length === 0) return false;

    let prevIndex = this.currentFocusIndex - 1;
    if (prevIndex < 0) {
      prevIndex = elements.length - 1; // Wrap to last element
    }

    return this.setFocus(prevIndex);
  }

  /**
   * Activate currently focused element
   */
  activateCurrentElement(): boolean {
    const elements = this.getSortedElements();
    const currentElement = elements[this.currentFocusIndex];

    if (currentElement?.enabled && currentElement.onActivate) {
      currentElement.onActivate();
      console.log(`⌨️ Activated element: ${currentElement.id}`);
      return true;
    }

    return false;
  }

  /**
   * Get accessibility props for keyboard navigation
   */
  getKeyboardAccessibilityProps(elementId: string): any {
    const element = this.focusableElements.get(elementId);
    if (!element) return {};

    const isFocused = this.getCurrentFocusedElementId() === elementId;

    return {
      accessible: true,
      accessibilityRole: 'button',
      focusable: element.enabled,
      onFocus: () => this.handleElementFocus(elementId),
      onBlur: () => this.handleElementBlur(elementId),
      ...(Platform.OS === 'web' && {
        tabIndex: element.enabled ? element.order : -1,
        onKeyDown: (event: any) => this.handleElementKeyDown(event, elementId),
        style: {
          outline:
            isFocused && this.config.focusRingVisible
              ? '2px solid #007AFF'
              : 'none',
        },
      }),
    };
  }

  /**
   * Get download button keyboard navigation props
   */
  getDownloadButtonKeyboardProps(
    buttonId: string,
    onPress: () => void,
    disabled: boolean = false,
  ): any {
    this.registerElement({
      id: buttonId,
      ref: null,
      order: 1,
      enabled: !disabled,
      onActivate: onPress,
    });

    return {
      ...this.getKeyboardAccessibilityProps(buttonId),
      accessibilityLabel: 'Download Story',
      accessibilityHint: 'Press Enter or Space to download your story',
    };
  }

  /**
   * Get modal keyboard navigation props
   */
  getModalKeyboardProps(modalId: string, onDismiss?: () => void): any {
    const props: any = {
      accessible: true,
      accessibilityViewIsModal: true,
      accessibilityRole: 'dialog',
    };

    if (
      onDismiss &&
      this.config.enableEscapeKeyDismissal &&
      Platform.OS === 'web'
    ) {
      props.onKeyDown = (event: any) => {
        if (event.key === 'Escape') {
          onDismiss();
          return true;
        }
        return false;
      };
    }

    return props;
  }

  /**
   * Get list item keyboard navigation props
   */
  getListItemKeyboardProps(
    itemId: string,
    index: number,
    onPress: () => void,
    onMenuOpen?: () => void,
  ): any {
    this.registerElement({
      id: itemId,
      ref: null,
      order: 10 + index, // List items start at order 10
      enabled: true,
      onActivate: onPress,
    });

    const props = {
      ...this.getKeyboardAccessibilityProps(itemId),
      accessibilityRole: 'button',
      accessibilityHint:
        'Press Enter to view options, or use arrow keys to navigate',
    };

    if (onMenuOpen && Platform.OS === 'web') {
      props.onKeyDown = (event: any) => {
        if (event.key === 'ArrowRight' || event.key === ' ') {
          onMenuOpen();
          return true;
        }
        return this.handleArrowKeyNavigation(event);
      };
    }

    return props;
  }

  /**
   * Get current focused element ID
   */
  getCurrentFocusedElementId(): string | null {
    const elements = this.getSortedElements();
    const currentElement = elements[this.currentFocusIndex];
    return currentElement?.id || null;
  }

  /**
   * Set keyboard navigation configuration
   */
  setConfig(config: Partial<KeyboardNavigationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⌨️ Keyboard navigation config updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): KeyboardNavigationConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable keyboard navigation
   */
  setEnabled(enabled: boolean): void {
    this.isActive = enabled;
    console.log(`⌨️ Keyboard navigation ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Private methods

  private getSortedElements(): FocusableElement[] {
    return Array.from(this.focusableElements.values())
      .filter(el => el.enabled)
      .sort((a, b) => a.order - b.order);
  }

  private sortElementsByOrder(): void {
    // Elements are sorted when retrieved, no need to maintain a separate sorted list
  }

  private setFocus(index: number): boolean {
    const elements = this.getSortedElements();
    if (index < 0 || index >= elements.length) return false;

    // Blur current element
    if (
      this.currentFocusIndex >= 0 &&
      this.currentFocusIndex < elements.length
    ) {
      const currentElement = elements[this.currentFocusIndex];
      if (currentElement.onBlur) {
        currentElement.onBlur();
      }
    }

    // Focus new element
    this.currentFocusIndex = index;
    const newElement = elements[index];

    if (newElement.onFocus) {
      newElement.onFocus();
    }

    // Focus the actual DOM element if on web
    if (Platform.OS === 'web' && newElement.ref?.current) {
      newElement.ref.current.focus();
    }

    console.log(`⌨️ Focused element: ${newElement.id}`);
    return true;
  }

  private handleElementFocus(elementId: string): void {
    const elements = this.getSortedElements();
    const index = elements.findIndex(el => el.id === elementId);
    if (index >= 0) {
      this.currentFocusIndex = index;
    }
  }

  private handleElementBlur(elementId: string): void {
    const element = this.focusableElements.get(elementId);
    if (element?.onBlur) {
      element.onBlur();
    }
  }

  private handleElementKeyDown(event: any, elementId: string): boolean {
    if (!this.isActive) return false;

    const handled = this.handleGlobalKeyDown(event);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }

    return handled;
  }

  private handleGlobalKeyDown(event: any): boolean {
    const { key } = event;

    switch (key) {
      case 'Tab':
        if (this.config.enableTabNavigation) {
          if (event.shiftKey) {
            return this.focusPrevious();
          } else {
            return this.focusNext();
          }
        }
        break;

      case 'ArrowUp':
      case 'ArrowDown':
        if (this.config.enableArrowKeyNavigation) {
          return this.handleArrowKeyNavigation(event);
        }
        break;

      case 'Enter':
        if (this.config.enableEnterKeyActivation) {
          return this.activateCurrentElement();
        }
        break;

      case ' ':
      case 'Spacebar':
        if (this.config.enableSpaceKeyActivation) {
          return this.activateCurrentElement();
        }
        break;

      case 'Escape':
        if (this.config.enableEscapeKeyDismissal) {
          return this.handleEscapeKey();
        }
        break;
    }

    // Check custom handlers
    const handler = this.keyboardHandlers.get(key);
    if (handler) {
      return handler.handler(event);
    }

    return false;
  }

  private handleArrowKeyNavigation(event: any): boolean {
    const { key } = event;

    switch (key) {
      case 'ArrowUp':
        return this.focusPrevious();
      case 'ArrowDown':
        return this.focusNext();
      case 'ArrowLeft':
        return this.focusPrevious();
      case 'ArrowRight':
        return this.focusNext();
    }

    return false;
  }

  private handleEscapeKey(): boolean {
    // This should be handled by individual components
    console.log('⌨️ Escape key pressed');
    return false;
  }

  private setupWebKeyboardHandlers(): void {
    if (Platform.OS !== 'web') return;

    this.handleWebKeyDown = this.handleWebKeyDown.bind(this);
    (globalThis as { document?: EventTarget }).document?.addEventListener(
      'keydown',
      this.handleWebKeyDown,
    );
  }

  private setupNativeKeyboardHandlers(): void {
    // React Native doesn't have built-in keyboard navigation
    // This would require custom native modules or third-party libraries
    console.log('⌨️ Native keyboard navigation setup (limited support)');
  }

  private handleWebKeyDown = (event: KeyboardEvent): void => {
    if (!this.isActive) return;

    const handled = this.handleGlobalKeyDown(event);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /**
   * Add custom keyboard handler
   */
  addKeyboardHandler(key: string, handler: KeyboardEventHandler): void {
    this.keyboardHandlers.set(key, handler);
    console.log(`⌨️ Added keyboard handler for: ${key}`);
  }

  /**
   * Remove custom keyboard handler
   */
  removeKeyboardHandler(key: string): void {
    this.keyboardHandlers.delete(key);
    console.log(`⌨️ Removed keyboard handler for: ${key}`);
  }

  /**
   * Get keyboard navigation instructions for users
   */
  getKeyboardInstructions(): string[] {
    const instructions: string[] = [];

    if (this.config.enableTabNavigation) {
      instructions.push('Use Tab/Shift+Tab to navigate between elements');
    }

    if (this.config.enableArrowKeyNavigation) {
      instructions.push('Use arrow keys to navigate lists and options');
    }

    if (this.config.enableEnterKeyActivation) {
      instructions.push('Press Enter to activate buttons and confirm actions');
    }

    if (this.config.enableSpaceKeyActivation) {
      instructions.push('Press Space to activate buttons');
    }

    if (this.config.enableEscapeKeyDismissal) {
      instructions.push('Press Escape to close modals and cancel actions');
    }

    return instructions;
  }
}

// Export singleton instance
export const downloadKeyboardNavigation =
  new DownloadKeyboardNavigationService();
export default downloadKeyboardNavigation;
