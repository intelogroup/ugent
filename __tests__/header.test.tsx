import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from '@/components/ui/header'
import { describe, it, expect, vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// Mock convex/react
vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}))

// Mock WorkOS auth so NotificationBell's useAuth doesn't require a provider
vi.mock('@workos-inc/authkit-nextjs/components', () => ({
  useAuth: () => ({ user: { firstName: 'Test' } }),
}))

describe('Header Component', () => {
  it('renders the bot title correctly', () => {
    render(<Header onMenuClick={() => {}} />)
    expect(screen.getByText('UGent MedBot')).toBeInTheDocument()
  })

  it('calls onMenuClick when the menu button is clicked', () => {
    const onMenuClick = vi.fn()
    render(<Header onMenuClick={onMenuClick} />)

    const menuButton = screen.getByLabelText('Toggle Menu')
    fireEvent.click(menuButton)

    expect(onMenuClick).toHaveBeenCalledTimes(1)
  })

  it('calls onNewChat when the new chat button is clicked', () => {
    const onNewChat = vi.fn()
    render(<Header onMenuClick={() => {}} onNewChat={onNewChat} />)

    const newChatButton = screen.getByLabelText('New Chat')
    fireEvent.click(newChatButton)

    expect(onNewChat).toHaveBeenCalledTimes(1)
  })
})
