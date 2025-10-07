# Copilot Instruct for Casino Website with Funny Interactive Gambling Games

## Project Overview
- Build a web-based casino featuring funny, interactive gambling games.
- Tech stack: 
  - **Frontend:** React.js (TypeScript), TailwindCSS, WebSockets (Socket.IO), PixiJS or Three.js for game graphics.
  - **Backend:** Node.js (Express or NestJS), TypeScript, **MySQL** (main database), Redis (optional for real-time/session data).
  - **Dev Environment:** All services are run together using **Docker Compose** for easy local development.
  - **Security:** JWT authentication, HTTPS, provably fair game logic.

## Docker & Development Environment
- The project uses **Docker Compose** to orchestrate the frontend, backend, and database services locally.
- Each service (frontend, backend, MySQL) should have its own Dockerfile tailored for development.
- Environment variables for each service (DB credentials, API URLs, JWT secrets, etc.) must be set via `docker-compose.yml`.
- The database service uses a persistent Docker volume for data.
- Hot reloading is enabled for both frontend and backend in development containers.
- Example Compose commands:
  - `docker-compose up --build` to start all services.
  - `docker-compose down -v` to stop and remove containers and volumes.

## Coding Guidelines
- Use TypeScript on both frontend and backend.
- Use async/await for all asynchronous operations.
- All database interactions should use parameterized queries or use an ORM (e.g., Prisma, TypeORM) to prevent SQL injection.
- Structure backend code into modules: routes/controllers, services, models, and utils.
- Game logic must run server-side for fairness and integrity.
- Include detailed comments for complex logic, especially for gambling algorithms.

## Database (MySQL) Notes
- Use InnoDB tables, with appropriate indexes for user, session, and transaction tables.
- Store passwords securely (bcrypt or Argon2).
- Use transactions for all money-related operations.
- Example table structure:

  ```sql
  CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    balance DECIMAL(18,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

## Game & Interactivity
- Use WebSockets for real-time game updates.
- All user actions that affect game state or bets should be validated server-side.
- Prefer using PixiJS for 2D games or Three.js for 3D.

## Security & Fairness
- All sensitive operations (bets, balance changes) must be atomic and validated.
- Implement provably fair gaming logic and expose hashes/seeds as needed.
- Use HTTPS and sanitize all user inputs.

## Example Prompt for Copilot
- “Create a TypeScript Express route for placing a bet, using MySQL transactions and updating the user's balance.”
- “Write a Dockerfile for the backend that enables hot reloading with Nodemon.”
- “Update docker-compose.yml to add a Redis service.”

## Code Style
- Use Prettier and ESLint for code formatting.
- Prefer functional components and hooks in React.
- Use environment variables for all secrets and database credentials.

---

*This instruct guides Copilot to generate secure, scalable, and readable code for a casino website with interactive gambling games using MySQL and Docker Compose for development.*