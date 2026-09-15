export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-3 border-gray-200" />
        <div className="absolute top-0 left-0 w-10 h-10 rounded-full border-3 border-transparent animate-spin"
             style={{borderTopColor: '#FFE600'}} />
      </div>
    </div>
  )
}
