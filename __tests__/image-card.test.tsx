import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageCard } from '../components/image-card';

// Mock Next.js Image (not meaningful in jsdom)
vi.mock('next/image', () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} />
  ),
}));

describe('ImageCard', () => {
  it('renders image with caption and source when meta is provided', () => {
    render(
      <ImageCard
        imageId="abc123"
        meta={{ caption: 'Glycolysis', source_book: 'First Aid 2023', page_number: 42 }}
      />
    );
    // Both card img and lightbox img share the same alt text
    expect(screen.getAllByAltText('Glycolysis').length).toBeGreaterThan(0);
    // Caption appears in both card strip and lightbox — assert presence, not uniqueness
    expect(screen.getAllByText('Glycolysis').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/First Aid 2023/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/p\. 42/).length).toBeGreaterThan(0);
  });

  it('shows REF ID strip when no meta is provided', () => {
    render(<ImageCard imageId="abc123" />);
    expect(screen.getByText(/REF: abc123/)).toBeInTheDocument();
  });

  it('shows error placeholder when image fails to load', () => {
    render(<ImageCard imageId="bad-id" />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(screen.getByText('Image not available')).toBeInTheDocument();
    // The img element is gone after error state
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('opens dialog when zoom button is clicked', () => {
    render(<ImageCard imageId="abc123" meta={{ caption: 'Test figure' }} />);
    const button = screen.getByRole('button', { name: /click to zoom/i });
    const dialog = document.querySelector('dialog')!;
    // jsdom doesn't implement showModal — define it before spying
    dialog.showModal = vi.fn();
    const spy = vi.spyOn(dialog, 'showModal');
    fireEvent.click(button);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('closes dialog when close button is clicked', () => {
    render(<ImageCard imageId="abc123" />);
    const dialog = document.querySelector('dialog')!;
    // jsdom doesn't implement close — define it before spying
    dialog.close = vi.fn();
    const closeSpy = vi.spyOn(dialog, 'close');
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
