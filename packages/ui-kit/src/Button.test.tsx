import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from './Button';

describe('Button', () => {
  it('renders label', () => {
    render(<Button>Acquitter</Button>);
    expect(screen.getByText('Acquitter')).toBeInTheDocument();
  });
});
