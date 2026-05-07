// Shared Jest manual mock for @/utils/shareWrapper.
//
// Tests opt in with `jest.mock('@/utils/shareWrapper')` (or relative path).
// Provides the singleton class with a static `open` method as a jest.fn()
// that resolves to a successful share result by default. Tests override
// per-case:
//
//   import Share from '@/utils/shareWrapper';
//   (Share.open as jest.Mock).mockResolvedValueOnce({ success: false });

const open = jest.fn().mockResolvedValue({
  success: true,
  dismissedAction: false,
  message: 'Share completed successfully',
});

const ShareWrapper = { open };

module.exports = {
  __esModule: true,
  default: ShareWrapper,
};
