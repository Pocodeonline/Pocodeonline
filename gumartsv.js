const crypto = require('crypto');
const secretKey = Buffer.from('c1276b467926cb9039b21219d1e8e3d76d42b87f9b0898bcb5dbbef21f537fb4', 'hex');
const iv = Buffer.from('cce3f5c12fba2e8a90078a6ef79d6306', 'hex');
const encryptedCode = 'abf84138e394980bd46c35daca89791c58060597aae3cd6c7978a5617650aed31672bae676467d2491cf6d29ce7f3dacd7efea0a66d98eb52d118c56ef8d50ef77da33ab0bd6baf328cbc3f15089205dae4316116a76545a91c58cd144dd816f3d137b4e840eb3dd21f239b696250f8317be478611068fbadcc61711be8196a697b90460bfc057fed28da63dedd10ea1fd7997107d7d6bca6e405d0ca03033951fb280da7a1fdb71d01e0d583b8d26cc83db146a43fe2939ca32dcf552ddc0f5f3d060f21ba6627dca4df519ae317bd57d2353644135e16193d24f6d16927ae849919398d4c76110a914f888f0c48339d2f25e8323535392f4686e996ce2ee181e5e70230f1684a473e3bbd8f4549b36e5326ad2d049223595637a61863b76e880f5f56f6e786c812236e97fdb2c0c66cb79bfca2500b10fdb8385f91920cbaf1a1e8b864e27318917ab3b5c95c5390285fadedf548f75b38854a0c8fa344a117eadb324d79e0357a0854e8bd027bffddebb389001cc6aa400e4eb399b6925a54752a902b21dc0d5796f2647e8df9771e9e93020200009e88f01f6df72e6ee447b66b6a69088344b8cd1d7d059814cb23411d7ea82342ed387fd9766a08348e0da237f5e8fc0dbb8a11eb1e7cc7d52b9f1d4ce1ad8314e1a59b16fc048f4a62a96fc7c9e2145f5fd0b450dc65b2552efcf9770b67c10f5b1629900f7bf6a0af422c3cda34c66b412b058ff4af7ac089b3a33652356c40bdb6647568843053f5ef48b47baee55098a8a5400760b2363f54aaf1ecc7e59e93bc88e823d6323e2fd34b1811dea73a03fcd89077ed6954215b11951595a9a31bcfd2b5da416690d6694054d5d01c8909186d6cbdbdf1884bebf05b7150b1e6574ea89beb52b708ac6f5edb419254a964649abb27c298549cc5dda9f62fae4892858785684baf090cb4de47da7cef4716aa93bcb2c5346c39ba4935df11e83362ecd21f4d8eb769f6badb475382a884d0278efdd3a2634cd23210880325a0014ba8f7e2b8538574e876ef530c6072e5aa514474686466c2fa24e78ab51f08d3d32aceaecca588eb1e92e8d7ecbe67fa8d487afe536ea55a120356969491d74ea4ce94630cab40c2c6d5d756533fe11450c9906ee82f2682dc4717691101d4e1f8c7ad376b897e328e8e61051701fa5b3eee69488a5223d560f5897aeb315a9bc20cc010ea030750059e450449f4ece8fb32a44d6fa1708b49b00ae26e4e1f2868cfcb28885fdacb3cf3a6887d826cd79d2f77618de90e628ed9813461dc1a123f6903183bd75fd176fb2fdbd1746c8b12b6722c66c127a0463cd19175f61baa9fe4836b549e2de9318c7e353788f3ca823cebc520d7238f23a2a36cbbcbfc1cc85c655640bef059edb8cc58497d554d9d755270a759fea18e96866a130c5c460b919a9e04ac555dc4d4dae18edaca6862a99fa5e6139d07f37b784aa8d20b3fe340c1cc9157d2fe06872b6080027a75549217705f1e114ad93340f1ae8e77a7f18de80bb5c475bc0b7237e16727d9575d442dfc394a99c3fddb73a6e6d733d2cd3815d54026812e4c37db5c0cc85d0e141eaf41659d82171307fb8db76bcccfccc7d12b7c5a337c6c4c4b7e0a52841b47612487b71356a8da1ff17e99c5aea85ade8042bc8802c4b12b2c3f797654d94a27d03311ccf643fb45265ff087b546eab824a0321ab2aa39f267171226c8a8fc8149b9ccf2203254ffb9376618017de52bff25144cedfcfbf5762224081af70f6a09b48efbe59a22abf4bfcd1c5286a7752a027474196f602c7a42a0bbf4348f33b38c9bf15d40b42e517ed7ca521df3b9ff1823979766cda3c7481d8970bbd96d86c0647a1124cd2c3a5d84c701205e36ebde1752c1c36dd5042db3a88a0c2f23e8ab125cb715fb42168e9e100ef152b54a0a77d907db71fab47d7459dfcfd474411f72d2a371f91197c61288963763add087db780b6e567a285becce9717c64e46a7d2a591f5cb11e76d996ee3faaebe6dce4c3bfec84c03fd055a267294b44e3b6780bef668ed690f85a1bd69e586b65986c89abf2d62313349f54a65dc7a7e373d7ab71a569ccbb17f7c171c956efe36489db610446503bf82b48e49e8151485cdbffcfc2eef3876bcbec052300ca2d053b513f12651c287403ce46b2e8ab16d7884a4f667d0e3fcbe4622980c08ed1e17570618a839aba1ea069efc3a091d66f1e43fca1095ac9133b669cc9e8ff4e555750da250a83c1360de87fd0fafd81186c7fe4cb87af4cd22de8105c61c0ddab740df5836a12eaa2f9c2ed069e4166d602d142e83ab6490e5892aaa3b9b429522fd57b1cc4eb367b40142823c79dad6fd488fc3ca5d1c12909bdde86b6cf8c4b8a2b2af6a03e00f72c12e1f7a38b3c030d475a01caa633e08169ca2335d9012b6814014998aace77f8466f1129b678737de4aeae66363fb46870cf9c0cb3bc9b62ffa0b245d516bffcda28f006cf70d6fbee813c98a3ccd6025bd84376f1dfbe8e654d7d5b562f28e5d9bb5c1d8e14467f180d74823c2471693da76c92f31a5a1406c4965a0844b4aaa35304ae87a6258e90f6ad17ab8827b228e083f05c3b40e6ebd29b629dc0863328dac02cf4d936180e18277002aa1300bde7e9b8b6ff3456de909574931fc1ca36461060bca1fc34d9d319cbc2dc621655778b6f303e9a3a51a311f973bc96fc14a215af5d58e2bc428ba627cf3093af86431be2d5572721150d34950480cf1460f05253db09d16aa5039c77820fa9ceef2e06d312bacc64372bc4385bfb83df6d0e5a9d5fd8ca609f028324d7b685762abd74a435c664f5c20ed9fe71964ed86763dbe67f8ca2a95c50d2dce8648c7ba21b26dfe385e636a9eaf4857a21fd940531435cc31e7a18cefa208beaef97290a50bf604fdc9b56f29d9f37e7bcba1ee28663e62601a55371770ab7e7f0a3580332476d4c5c9bfa9aab02230fd0c79b8de7687f53049638bc4d73f02de6ae723870ff9dac2e60a332693a7d597d02a07f7c3fde10aa1cdaa2bdc25160ccc637d433d70d025bfdfe703298cb959d9f33b5180565624c9576078637d81b739f9976d1711524de8f671d97f54b2030bc5d67ccc60178ffa5807c69d95722bc5acac9d0b1e705129b22d5d0fca55f90dcb7a37242ca69a6b2dbea1829bc3140d4466e6770673bd186ef6da8b22610ed18c4766e1de6f58258ff26207ed0a3a41a06b1d85fdfa07581671effdba9cded584e9f05f759f7c0738003d91be04a6bfd4d7b404109aa2d7d59da679b0164390a3cd1ddee9e0b69628cca0a861aa9fac95b9e63e07eb63b5918ccdce3dcad057c74fda265e8aec8c96a46d77418c0268e385438c10c55b80d9ac740f86015bbb372f742aedf66a57ffbbbd8d817a5debbd8aa0db4c5ef8bda79c5976264ff492f4f5e9109f4110972d1bae6e74303a634e75d03b5325477b16e27befe06e05108907cc9a1a2172a5bb7371c7188e775c7dc15fcdd8545274c0bed6259eb490b8448b3e4cf1b905bb6148a3dbb1a89f4b167439fe5f30a7838329f2b4766a8336a9a18237f35420d673e7a1905641ca0a36e22138f628d4ca25cc768fef47e74339a0484dc2b603cc7784537d1733d3710ce1ed6a1e4f0e312a6ee07200aa115f5fbc553acdba4ae4d600977f29ba3622a3758ce0283fdbfa3abe39cd15913eb8186ef0a3552be0ea0940b29fe76874b9724c6076968ef3c4c3225559f479c0b7bca7ae9dd81754a0146ebd2ac923111a650c93695d89f17fe426d6538890f4effcf48f57b4a8487f25f38f32939c65559e34ebe4d3f5e906cd536fd0be455cc0612453fcc0edd9ce2d970d06adc6982e3c94a0305f938f579e9247c1bfdbb98a96a76807e527b213e1627546435f59c1d2ab94624808cc48cb93eb2b6b08f303035d30d2715cd8fb311e3bfac46417b6d51d031ea587eb9a8b469626735c5e141a413005ac26282103e0e70da6027838b43e14514b21a39ca7cc3d9634609696bb3787b9f5f98853f4ddcdba3611ad670fed872a09b7dd40cbbfa32659aab9c001756c7b6659da258129b4881f5436825f5ff7a2e2326e65360e76bbea85c3172d91587ab63de66ab6056c6c205fa51b5341d7e1e0ffa570862a1a244195d1a33df06b5b13a8e9339d5d9e76d2ab175681d673c79304ca21075475a8276bdc4cfd1e3bcbd0d79d64d9f81bdbf43d112e888c00de88abf9f18427f1273212cf87cda98648786ccaf078006e1e61dce7349cd97e004bb21be1983dc1a12ad1423750274d8a5629bdfd5b7460aad689b1d3f75c97621482c13fd81f04399b63ea045a722cc390a371ed4eed1672ad390c61e0d8490fdd96b2aa332087d3b37adddd0269c3063b722a4312e861de402db491a483e778e0aaba40e24f6900793ab74ac389d67157d702d910f9fd0bf9ff743eb62cf43bd5c74b8d357cc4615707e751ca291551eb4bbd40db06b841861c12b86e29b39f47a3de62f57ebecbc96e1c70b64f85c6e2acd3ef0338109cfb37b849fcf7c694d100a06511af856c39f110a710121b6e1a8dd641af3dd96105ba14ea71eef16be08bdc880b7ca1f0f9f0103baff5761905246bc36f2a67e7f6f5eda205477985bbbffbeb18af169407da579ebe8ed6775b1c150feece2219542bbde624699c2c37356d50e848193dc0cab7578dee585269eaed2b5a1558e73bbcef48b90389a5c29ed1c7363957c757186ef12dc0026b9de0f8f7b79b29033f6313714abc8a8d43a31139db014959dc3a68907a1f3b7dff63ace758ebd9c49cf114b8fcfa709ef75ccb7e6e62d207fefe01873454195f95aea481499f4a33c72bca404e313886acbc67b3262ec59ea138a9f0fc145d32cc585009d5dd1cdb73e01';

function decrypt(text) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const decryptedCode = decrypt(encryptedCode);
eval(decryptedCode);
