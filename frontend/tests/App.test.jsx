import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';
import { AUTH_TOKEN_STORAGE_KEY } from '../src/auth/accessToken.js';

function buildFakeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('App', () => {
  beforeEach(() => {
    localStorage.setItem(
      AUTH_TOKEN_STORAGE_KEY,
      buildFakeJwt({ directoryUserId: 'trainer-test', isTrainer: true })
    );
  });

  it('renders Content Studio title for authenticated trainers', () => {
    render(<App />);
    const title = screen.getByText('Content Studio');
    expect(title).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<App />);
    const coursesLinks = screen.getAllByText('Courses');
    expect(coursesLinks.length).toBeGreaterThan(0);
  });
});
