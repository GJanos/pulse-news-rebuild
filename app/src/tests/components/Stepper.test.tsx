import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Stepper from '../../components/Stepper';
import { THEMES, AESTHETICS } from '../../themes';

const theme = THEMES.light;
const aes = AESTHETICS.editorial;
const baseProps = { theme, aes, value: 5, min: 1, max: 10, onChange: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('Stepper — text variant (default)', () => {
  it('calls onChange with value-1 on decrement', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} onChange={onChange} />);
    // First pressable is the decrement button
    fireEvent.press(getAllByRole('button')[0]!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('calls onChange with value+1 on increment', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[1]!);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('clamps to min — calls onChange with min when already at min', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} value={1} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[0]!);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('clamps to max — calls onChange with max when already at max', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} value={10} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[1]!);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('renders suffix label', () => {
    const { getByText } = render(<Stepper {...baseProps} suffix="d" />);
    expect(getByText('5d')).toBeTruthy();
  });
});

describe('Stepper — icon variant', () => {
  it('calls onChange with value-1 on minus press', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} icons onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[0]!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('calls onChange with value+1 on plus press', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<Stepper {...baseProps} icons onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[1]!);
    expect(onChange).toHaveBeenCalledWith(6);
  });
});
