import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';

describe('App', () => {
  it('renders Content Studio title', () => {
    render(<App />);
    const title = screen.getByText('Content Studio');
    expect(title).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<App />);
    const coursesLink = screen.getByText('Courses');
    expect(coursesLink).toBeInTheDocument();
  });
});

