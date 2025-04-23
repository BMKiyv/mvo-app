const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        (error as any).status = res.status;
        throw error;
    }
    // Handle potential null response for responsible person
    if (res.status === 204 || res.headers.get('content-length') === '0') {
        return null; // Return null if response is empty or status 204/200 with null body
    }
    // Handle 200 OK with null explicitly returned from API
    const contentType = res.headers.get("content-type");
     if (contentType && contentType.indexOf("application/json") !== -1) {
        // Only parse JSON if the content type is correct
        return res.json().then(data => data === null ? null : data);
     } else {
        return null; // Return null if not JSON
     }
});

export default fetcher;