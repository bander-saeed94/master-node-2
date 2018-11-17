// async function addBlock(newBlock){

//     let heightN = await this.getBlockHieght()
//     //now you can user prevHeight
//     newBlock.height = heightN + 1
    
// }

// //Or
// async function addBlock(newBlock){
//     this.getBlockHieght().then( (heightN)=>{
//         newBlock.height = heightN + 1
//         //add remaining code here 
//         newBlock.height

//         //invoke saving to level db inside the then not outside
//         //since it
//     })
    
//     //if outside newBlock.height will be undefined
//     newBlock.height == undefined
// }
