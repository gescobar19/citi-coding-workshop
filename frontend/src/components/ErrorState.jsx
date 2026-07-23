import { Alert, AlertTitle, Box, Button } from "@mui/material";

export default function ErrorState({ error, onRetry }) {
  const isNetwork = error?.message?.includes("fetch") || error?.name === "TypeError";
  return (
    <Box sx={{ py: 2 }}>
      <Alert
        severity="error"
        action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : null}
      >
        <AlertTitle>{isNetwork ? "Cannot reach the API" : "Something went wrong"}</AlertTitle>
        {isNetwork
          ? "Is the FastAPI server running?"
          : error?.message || "Unknown error"}
      </Alert>
    </Box>
  );
}
