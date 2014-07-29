package com.joyent.piranha.pageobject.instancedetails;

import com.joyent.piranha.pageobject.AbstractPageObject;
import com.joyent.piranha.pageobject.ImageList;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class ImagesSection extends AbstractPageObject {
    public void setImageName(String imageName) {
        $("[name=\"imageName\"]").sendKeys(imageName);
    }

    public ImageList clickCreateImage(){
        $("[data-ng-click=\"clickCreateImage()\"]").click();
        return page(ImageList.class);
    }
}

