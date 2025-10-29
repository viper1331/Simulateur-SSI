import { render, screen } from '@testing-library/react';
import App from './App';

describe('Central panel App', () => {
  it('renders LCD and shortcuts', () => {
    render(<App />);
    expect(screen.getByText(/Afficheur LCD/i)).toBeInTheDocument();
    expect(screen.getByText(/Raccourcis clavier/i)).toBeInTheDocument();
  });
});
