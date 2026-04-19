import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BookmarkProvider } from './component/bookmark';
import './App.scss';
import routes from './routes';

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <BookmarkProvider>
                <div className="App">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        {routes.map((route) => (
                            <Route key={route.path} path={route.path} element={route.element} />
                        ))}
                    </Routes>
                </div>
            </BookmarkProvider>
        </BrowserRouter>
    );
};

export default App;