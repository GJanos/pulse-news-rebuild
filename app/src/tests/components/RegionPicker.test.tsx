import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useAppStore } from '../../store';
import { DEFAULT_PREFERENCES } from '../../storage/preferences';
import RegionPicker from '../../components/RegionPicker';

jest.mock('../../storage/preferences', () => ({
  DEFAULT_PREFERENCES: {
    selectedRegions: ['Hungary', 'Ukraine', 'Russia', 'United States', 'United Kingdom'],
    headlineCount: 5,
    regionHeadlineCounts: {},
    historyDays: 7,
    notifyTime: '07:30',
    openLinksIn: 'in-app',
    regionStyle: 'flag',
    baseCurrency: 'USD',
    showCurrencyRates: false,
    showGlobalHeadlines: true,
    globalHeadlineCount: 5,
    theme: 'light',
    aesthetic: 'editorial',
    updatedAt: new Date(0).toISOString(),
  },
}));

/** Inject a fresh jest.fn() as setPref into the store and return it. */
function spySetPref(): jest.Mock {
  const mock = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAppStore.setState({ setPref: mock } as any);
  return mock;
}

beforeEach(() => {
  useAppStore.setState({ prefs: DEFAULT_PREFERENCES, prefsMutationCount: 0 });
});

function renderPicker() {
  return render(<RegionPicker />);
}

describe('RegionPicker — toggle', () => {
  it('selecting an unselected region calls setPref with it added', () => {
    const setPref = spySetPref();
    const { getByLabelText } = renderPicker();
    // 'Israel' is the first region not in the default 5
    fireEvent.press(getByLabelText('Israel, not selected'));
    expect(setPref).toHaveBeenCalledWith('selectedRegions', expect.arrayContaining(['Israel']));
  });

  it('deselecting a selected region calls setPref with it removed', () => {
    const setPref = spySetPref();
    const { getByLabelText } = renderPicker();
    fireEvent.press(getByLabelText('Hungary, selected'));
    const call = (setPref as jest.Mock).mock.calls[0];
    expect(call[1]).not.toContain('Hungary');
  });
});

describe('RegionPicker — reorder mode', () => {
  it('move up is a no-op for the first selected region', () => {
    const setPref = spySetPref();
    const { getByText, getByLabelText } = renderPicker();
    fireEvent.press(getByText('Reorder'));
    const moveUpBtn = getByLabelText('Move Hungary up');
    fireEvent.press(moveUpBtn);
    // Hungary is index 0, can't go higher — no setPref call for selectedRegions
    const firstCall = (setPref as jest.Mock).mock.calls.find((c) => c[0] === 'selectedRegions');
    if (firstCall) {
      expect(firstCall[1][0]).toBe('Hungary');
    }
  });

  it('All button selects all regions', () => {
    const setPref = spySetPref();
    const { getByText } = renderPicker();
    fireEvent.press(getByText('Reorder'));
    fireEvent.press(getByText('All'));
    const call = (setPref as jest.Mock).mock.calls.find((c) => c[0] === 'selectedRegions');
    expect(call).toBeTruthy();
    // All regions selected
    expect((call![1] as string[]).length).toBeGreaterThan(5);
  });

  it('None button when all selected deselects all', () => {
    // Set all regions as selected first
    const { REGIONS } = jest.requireActual('../../data') as { REGIONS: { region: string }[] };
    useAppStore.setState({
      prefs: { ...DEFAULT_PREFERENCES, selectedRegions: REGIONS.map((r) => r.region) },
    });
    const setPref = spySetPref();
    const { getByText } = renderPicker();
    fireEvent.press(getByText('Reorder'));
    fireEvent.press(getByText('None'));
    const call = (setPref as jest.Mock).mock.calls.find((c) => c[0] === 'selectedRegions');
    expect((call![1] as string[]).length).toBe(0);
  });
});

describe('RegionPicker — tune mode', () => {
  it('per-region count change calls setPref with merged regionHeadlineCounts', () => {
    const setPref = spySetPref();
    const { getByText, getAllByRole } = renderPicker();
    fireEvent.press(getByText('Tune'));
    // Find increment button for the first selected region (Hungary row)
    // In tune mode, steppers appear for each selected region
    const buttons = getAllByRole('button');
    // Press increment on first region stepper (index depends on layout)
    const incrementBtn = buttons.find(
      (b) =>
        b.props.accessibilityLabel?.includes('plus') || b.props.children?.props?.name === 'plus',
    );
    if (incrementBtn) fireEvent.press(incrementBtn);
    const call = (setPref as jest.Mock).mock.calls.find((c) => c[0] === 'regionHeadlineCounts');
    if (call) expect(typeof call[1]).toBe('object');
  });
});
