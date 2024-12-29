# 🌙 Lunar Code Stats

A Next.js application that analyzes your GitHub commit patterns in relation to lunar phases and weather conditions.

## Features

- GitHub OAuth integration
- Commit analysis by lunar phase
- Weather impact on coding patterns
- Beautiful, responsive UI with Tailwind CSS

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/lunar-code.git
   cd lunar-code
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```
   GITHUB_ID=your_github_client_id
   GITHUB_SECRET=your_github_client_secret
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret
   ```

4. Create a GitHub OAuth application:
   - Go to GitHub Settings > Developer settings > OAuth Apps > New OAuth App
   - Set Homepage URL to `http://localhost:3000`
   - Set Authorization callback URL to `http://localhost:3000/api/auth/callback/github`
   - Copy the Client ID and Client Secret to your `.env.local` file

5. Generate a NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output to your `NEXTAUTH_SECRET` in `.env.local`

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

The project structure follows Next.js 13+ conventions with the App Router:

```
src/
  app/
    api/
      auth/[...nextauth]/
      commits/
    dashboard/
    page.tsx
  lib/
    github.ts
    lunar.ts
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.md](docs/LICENSE.md) file for details.
