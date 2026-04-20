# Application Architecture & Technology Stack

## Overview
This document outlines the complete technical architecture of the application, detailing each layer, its components, technologies used, and their interactions. This architecture follows a hybrid approach combining modern web frameworks, AI/ML capabilities, and scalable database solutions.

---

## Table of Contents
1. [Frontend Layer](#frontend-layer)
2. [Business Logic Layer](#business-logic-layer)
3. [AI Model Layer](#ai-model-layer)
4. [Data Layer](#data-layer)
5. [Backend & Hosting](#backend--hosting)
6. [Authentication & Security](#authentication--security)
7. [Data Export & Reporting](#data-export--reporting)
8. [Communication & API](#communication--api)
9. [System Architecture Diagram](#system-architecture-diagram)

---

## Frontend Layer

### Purpose
The frontend layer provides the user interface and visualization capabilities for the application, enabling users to interact with and preview data transformations in real-time.

### Components

#### 1. **UI Framework**
- **Technology**: React + TypeScript
- **Description**: Custom web UI built with React for component-based architecture and TypeScript for type safety
- **Responsibilities**:
  - User interface components
  - Form handling and validation
  - User interactions and events
  - State management integration

#### 2. **Rendering Engine (Preview Panel)**
- **Technology**: React Flow (Open Source Software)
- **Description**: Specialized visualization library for rendering node-based diagrams
- **Responsibilities**:
  - Real-time preview of data transformations
  - Visual representation of data flow
  - Interactive node and edge manipulation
  - Pan and zoom capabilities

#### 3. **Model Renderer**
- **Technology**: Canvas Renderer (React Flow + React TypeScript with npm packages and custom logic)
- **Description**: Custom rendering engine that combines React Flow's capabilities with canvas-based rendering for complex visualizations
- **Responsibilities**:
  - Rendering data models visually
  - Updating previews in real-time
  - Optimizing performance for large datasets
  - Handling custom visualization logic

#### 4. **Hosting Server**
- **Technology**: Vercel
- **Description**: Serverless hosting platform for frontend deployment
- **Responsibilities**:
  - Frontend deployment and hosting
  - Automatic CI/CD pipeline
  - Edge caching and CDN
  - Environment variable management

---

## Business Logic Layer

### Purpose
The business logic layer handles all data processing, validation, and orchestration between the frontend and backend systems.

### Components

#### 1. **Communication Layer**
- **Technology**: API Router (Next.js API Routes - built-in)
- **Description**: RESTful API endpoints built using Next.js API routes
- **Responsibilities**:
  - Routing HTTP requests
  - Request validation and sanitization
  - Response formatting
  - Error handling and logging

#### 2. **Input Document Processing**
- **Technology**: Spreadsheet Parser (SheetJS - npm)
- **Description**: Library for parsing and processing spreadsheet files (Excel, CSV, etc.)
- **Responsibilities**:
  - Reading spreadsheet data
  - Data format conversion
  - Handling various spreadsheet formats
  - Data extraction and normalization

#### 3. **Context Aggregator**
- **Technology**: Context Builder (TypeScript - custom logic)
- **Description**: Custom logic to aggregate and prepare context for LLM processing
- **Responsibilities**:
  - Collecting relevant data from multiple sources
  - Structuring data for LLM input
  - Enriching data with business context
  - Preparing prompts and parameters

#### 4. **LLM Output Processing**
- **Technology**: Diff Normalizer (TypeScript - custom logic)
- **Description**: Custom logic to clean and normalize LLM-generated output
- **Responsibilities**:
  - Parsing LLM responses
  - Normalizing differences in format
  - Converting output to usable data structures
  - Handling various response formats

#### 5. **Validation Layer**
- **Technology**: Diff Validator (Zod - npm)
- **Description**: Schema validation library for validating data structures
- **Responsibilities**:
  - Validating LLM output against schemas
  - Internal business rule validation
  - Type checking and data integrity
  - Error reporting and feedback

#### 6. **State Management**
- **Technology**: State Store (Zustand - npm)
- **Description**: Lightweight state management library for managing application state
- **Responsibilities**:
  - Storing current application state
  - Managing state updates
  - Comparing state against changes
  - Providing state snapshots for history tracking
  - Enabling undo/redo functionality

---

## AI Model Layer

### Purpose
The AI layer provides intelligent processing capabilities for data transformation and analysis.

### Components

#### 1. **Large Language Model (LLM)**
- **Technology**: Claude Sonnet (via Anthropic API)
- **Description**: Advanced large language model for complex reasoning and data transformation
- **Responsibilities**:
  - Processing natural language inputs
  - Complex data transformation logic
  - Context-aware processing
  - High-quality output generation

#### 2. **Small Language Model (SLM)**
- **Technology**: Phi-3 (Microsoft's efficient model)
- **Description**: Lightweight language model for simpler, faster operations
- **Responsibilities**:
  - Lightweight inference tasks
  - Lower latency operations
  - Cost-effective processing
  - Local deployment capability

### AI Orchestration
- The system determines which model to use based on task complexity
- Claude Sonnet handles critical, complex transformations
- Phi-3 handles routine, standardized operations
- Dynamic routing based on input characteristics

---

## Data Layer

### Purpose
The data layer provides persistent storage, caching, and retrieval capabilities across multiple database technologies.

### Components

#### 1. **Vector Embedding Generator**
- **Technology**: OpenAI Embedding Generator
- **Description**: Service for converting text and data into vector embeddings
- **Responsibilities**:
  - Generating semantic embeddings
  - Converting unstructured data to vectors
  - Enabling similarity search capabilities
  - Supporting RAG (Retrieval Augmented Generation) workflows

#### 2. **Vector Database**
- **Technology**: PostgreSQL with pgvector extension
- **Description**: Vector-capable relational database for storing embeddings
- **Responsibilities**:
  - Storing vector embeddings
  - Performing similarity searches
  - Maintaining vector indexes
  - Supporting hybrid search queries (vector + traditional SQL)

#### 3. **Document Store**
- **Technology**: PostgreSQL (via Supabase)
- **Description**: Relational database for structured document storage
- **Responsibilities**:
  - Storing application documents
  - Maintaining document metadata
  - Supporting document versioning
  - Enabling full-text search

#### 4. **Cache Database**
- **Technology**: Redis Cache DB
- **Description**: In-memory caching layer for fast data retrieval
- **Responsibilities**:
  - Caching frequently accessed data
  - Reducing database queries
  - Improving response times
  - Session management
  - Temporary state storage

#### 5. **Graph Database**
- **Technology**: Neo4J
- **Description**: Graph database for relationship-heavy data structures
- **Responsibilities**:
  - Storing relational data structures
  - Managing complex relationships
  - Enabling sophisticated queries on data relationships
  - Supporting path-finding and traversal queries

### Data Storage Strategy
- **Document Storage**: Structured application data
- **Vector Storage**: Semantic data for similarity search
- **Graph Storage**: Relationship and hierarchical data
- **Cache Layer**: Hot data and frequently accessed items
- **Backup**: Regular snapshots across all databases

---

## Backend & Hosting

### Purpose
Backend infrastructure to support the application at scale.

### Backend Hosting Server
- **Technology**: Railway
- **Description**: Cloud platform for deploying and hosting backend services
- **Responsibilities**:
  - Hosting API servers
  - Running background jobs
  - Managing environment configuration
  - Auto-scaling capabilities
  - Monitoring and logging

### Deployment Architecture
- Containerized services using Docker
- Automated deployment pipelines
- Environment isolation (dev, staging, production)
- Load balancing and auto-scaling
- Health checks and monitoring

---

## Authentication & Security

### Purpose
Secure access control and data protection for the application.

### Components

#### 1. **Database Authentication**
- **Technology**: Supabase (PostgreSQL Authentication)
- **Description**: Authentication service integrated with PostgreSQL
- **Responsibilities**:
  - User authentication
  - Session management
  - Permission management
  - Row-level security policies
  - API key management

#### 2. **Security Features**
- JWT token-based authentication
- Row-level security (RLS) policies in PostgreSQL
- Encrypted credentials storage
- API rate limiting
- CORS configuration
- Input validation and sanitization

---

## Data Export & Reporting

### Purpose
Enable users to export and interact with processed data.

### Components

#### 1. **Data Export Module**
- **Technology**: Custom code (React + TypeScript)
- **Description**: Custom implementation for data export functionality
- **Responsibilities**:
  - Exporting data to multiple formats (CSV, Excel, JSON)
  - Formatting data for different use cases
  - Handling large dataset exports
  - Streaming exports for performance
  - Generating reports

---

## Communication & API

### Purpose
Facilitate communication between all system components.

### Architecture

#### 1. **API Framework**
- **Technology**: Next.js API Routes
- **Description**: Built-in API routing system in Next.js
- **Advantages**:
  - Unified framework for frontend and backend
  - TypeScript support throughout
  - File-based routing for API endpoints
  - Built-in middleware support
  - Serverless deployment ready

#### 2. **API Endpoints Structure**

```
/api/documents
  - POST: Upload and parse spreadsheet
  - GET: Retrieve document list
  - GET/:id: Get specific document

/api/transform
  - POST: Trigger data transformation
  - GET/:id/status: Get transformation status
  - GET/:id/result: Get transformation result

/api/embeddings
  - POST: Generate embeddings
  - GET: Retrieve embeddings

/api/export
  - POST: Export data
  - GET/:id: Download export

/api/graph
  - POST: Create graph relationships
  - GET: Query graph relationships
```

#### 3. **Communication Flow**

```
Frontend (React + TypeScript)
    ↓
Next.js API Routes
    ↓
├── Context Builder (Business Logic)
├── LLM Processing (Claude/Phi-3)
├── Database Layer (PostgreSQL, Redis, Neo4J)
└── External Services (OpenAI Embeddings)
    ↓
Response back to Frontend
```

---

## System Architecture Diagram

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ React + TS   │  │ React Flow   │  │ Canvas Renderer │   │
│  │ Custom Web   │  │ (Preview)    │  │ (Model Visual)  │   │
│  │ UI           │  │              │  │                 │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│                    (Hosted on Vercel)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              BUSINESS LOGIC LAYER (Next.js)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Router (Next.js API Routes)                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │Spreadsheet │ │Context Builder│ │State Store (Zustand)│   │
│  │Parser      │ │(Custom TS)    │ │(Client & Server)   │   │
│  │(SheetJS)   │ │              │ │                    │   │
│  └────────────┘ └──────────────┘ └─────────────────────┘   │
│  ┌────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │Diff        │ │Diff Validator │ │LLM Output Handler  │   │
│  │Normalizer  │ │(Zod)         │ │(Custom TS)         │   │
│  │(Custom TS) │ │              │ │                    │   │
│  └────────────┘ └──────────────┘ └─────────────────────┘   │
│                   (Hosted on Railway)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
┌──────────────────┐ ┌──────────────┐ ┌────────────────┐
│  AI MODEL LAYER  │ │ VECTOR EMBEDDINGS │ EXTERNAL SERVICES│
│  ┌──────────┐   │ │  (OpenAI API)    │ │   (Third-party)  │
│  │Claude    │   │ │              │    │               │
│  │Sonnet    │   │ │              │    │               │
│  │(Complex) │   │ └──────────────┘    │               │
│  ├──────────┤   │                     │               │
│  │Phi-3     │   │                     │               │
│  │(Simple)  │   │                     │               │
│  └──────────┘   │                     │               │
└──────────────────┘ └──────────────────┘ └────────────────┘
        │                     │
        └─────────────────────┼─────────────────┐
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │PostgreSQL    │ │Redis Cache   │ │Neo4J Graph DB    │   │
│  │(Document)    │ │(Hot Data)    │ │(Relationships)   │   │
│  │+ pgvector    │ │              │ │                  │   │
│  │(Vectors)     │ │              │ │                  │   │
│  └──────────────┘ └──────────────┘ └──────────────────┘   │
│  (Managed by Supabase)            (Standalone Service)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Walkthrough

### 1. **Document Upload & Processing**
```
1. User uploads spreadsheet via Frontend
2. Next.js API receives file
3. SheetJS Parser extracts data
4. Data validated against schema (Zod)
5. Context Builder enriches data with context
6. OpenAI generates embeddings
7. Data stored in PostgreSQL + vectors in pgvector
```

### 2. **Transformation Request**
```
1. User requests transformation
2. Frontend sends request to Next.js API
3. Context Builder prepares LLM prompt
4. Route to Claude Sonnet or Phi-3 based on complexity
5. LLM processes and returns result
6. Diff Normalizer cleans output
7. Diff Validator validates against schema
8. Result stored in PostgreSQL
9. Cache updated in Redis for quick access
10. Result returned to Frontend
```

### 3. **State Management**
```
1. Current state stored in Zustand (client + server)
2. Redis Cache mirrors hot state
3. PostgreSQL maintains historical state
4. Neo4J stores state relationships
5. User sees real-time updates via Frontend
```

### 4. **Data Export**
```
1. User requests export
2. Custom React/TS export module prepares data
3. Format conversion (CSV, Excel, JSON)
4. File generated and streamed to user
5. Download initiated in Frontend
```

---

## Technology Stack Summary

### Frontend Technologies
- **Framework**: React 18+ with TypeScript
- **Visualization**: React Flow, Canvas
- **State Management**: Zustand
- **Hosting**: Vercel

### Backend Technologies
- **Framework**: Next.js with API Routes
- **Language**: TypeScript
- **Parsing**: SheetJS
- **Validation**: Zod
- **Hosting**: Railway
- **Container**: Docker

### AI/ML Technologies
- **LLM**: Claude Sonnet (Anthropic)
- **SLM**: Phi-3 (Microsoft)
- **Embeddings**: OpenAI Embedding API

### Database Technologies
- **Relational**: PostgreSQL (via Supabase)
- **Vector**: pgvector (PostgreSQL extension)
- **Cache**: Redis
- **Graph**: Neo4J
- **Authentication**: Supabase Auth

### Development & DevOps
- **Language**: TypeScript throughout
- **Package Manager**: npm
- **API Documentation**: OpenAPI/Swagger (recommended)
- **Monitoring**: Logging via Railway/Supabase
- **CI/CD**: Git-based (Vercel + Railway)

---

## Scalability Considerations

### Horizontal Scaling
- Frontend: CDN distribution via Vercel
- Backend: Auto-scaling on Railway
- Databases: Read replicas in PostgreSQL, Redis cluster

### Performance Optimization
- Caching layer (Redis) for frequent queries
- Vector search for large dataset similarity
- Graph database for relationship queries
- Lazy loading in Frontend
- Code splitting in React

### Cost Optimization
- Phi-3 for routine operations (cheaper than Claude)
- Redis caching reduces database hits
- Vercel edge caching for Frontend
- Railway auto-scaling only when needed

---

## Security Best Practices Implemented

1. **Authentication**: JWT tokens via Supabase
2. **Data Encryption**: In-transit (HTTPS) and at-rest (PostgreSQL encryption)
3. **Access Control**: Row-level security policies
4. **Input Validation**: Zod schema validation
5. **API Security**: Rate limiting, CORS configuration
6. **Environment Secrets**: Secure storage of API keys
7. **Audit Logging**: Track API requests and data changes

---

## Deployment Checklist

- [ ] Frontend deployment on Vercel
- [ ] Backend deployment on Railway
- [ ] Database setup (PostgreSQL, Redis, Neo4J)
- [ ] Authentication configuration (Supabase)
- [ ] Environment variables configured
- [ ] API keys secured (OpenAI, Anthropic)
- [ ] SSL/TLS certificates configured
- [ ] Monitoring and alerting enabled
- [ ] Backup and disaster recovery plan
- [ ] Performance testing completed
- [ ] Security audit performed

---

## Future Enhancements

1. **Multi-model Support**: Add support for additional LLMs
2. **Advanced Analytics**: Dashboard with usage metrics
3. **API Rate Limiting**: Implement token bucket algorithm
4. **Real-time Collaboration**: WebSocket support for live updates
5. **Advanced Caching**: Implement cache invalidation strategies
6. **Monitoring**: ELK stack for log aggregation
7. **Testing**: Comprehensive test suite (unit, integration, e2e)
8. **Documentation**: API documentation with Swagger/OpenAPI

---

## Contact & Support

For questions about this architecture or technical implementation details, refer to the development team or project documentation.

---

**Document Version**: 1.0  
**Last Updated**: April 2026  
**Status**: Ready for Distribution
