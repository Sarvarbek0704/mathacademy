'use client';

import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  *{ box-sizing:border-box; }
  html,body{ padding:0; margin:0; height:100%; }
  body{
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background:#0b0f19;
    color:#e8eefc;
  }
  a{ color:inherit; text-decoration:none; }
`;
