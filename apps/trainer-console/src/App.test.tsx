import { render, screen } from '@testing-library/react';
import App from './App';

describe('Trainer App', () => {
  it('renders title', () => {
    render(<App />);
    expect(screen.getByText(/Console Formateur SSI/)).toBeInTheDocument();
  });
});
